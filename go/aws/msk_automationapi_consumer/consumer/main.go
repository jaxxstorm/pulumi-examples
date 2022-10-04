package main

import (
	"context"
	"fmt"
	neturl "net/url"
	"os"
	"sort"
	"strings"
	"encoding/csv"
	"io"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	"golang.org/x/term"

	"github.com/pulumi/pulumi/sdk/v3/go/auto"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/events"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optdestroy"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optup"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	kafka "github.com/segmentio/kafka-go"
	"gopkg.in/alecthomas/kingpin.v2"
)

const columnWidth = 50

// Style definitions.
var (
	app        = kingpin.New("event-drive-infrastructure", "Consume a kafka message with information to create infrastructure.")
	deployCmd  = app.Command("deploy", "Deploy a container image.")
	destroyCmd = app.Command("destroy", "Destroy a deployment")
	name       = app.Flag("name", "Deployment name to use").String()

	// kingpin vars
	brokerUrls = deployCmd.Flag("broker-url", "Kafka urls to use for requests").Strings()
	topic      = deployCmd.Flag("topic", "Kafka topic to use for requests").String()

	subtle  = lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}
	special = lipgloss.AdaptiveColor{Light: "#43BF6D", Dark: "#73F59F"}

	list = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder(), false, true, false, false).
		BorderForeground(subtle).
		MarginRight(2).
		Height(8).
		Width(columnWidth + 1)

	listHeader = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderBottom(true).
			BorderForeground(subtle).
			MarginRight(2).
			Render

	listItem = lipgloss.NewStyle().PaddingLeft(2).Render

	checkMark = lipgloss.NewStyle().SetString("✓").
			Foreground(special).
			PaddingRight(1).
			String()

	listDone = func(s string) string {
		return checkMark + lipgloss.NewStyle().
			Strikethrough(true).
			Foreground(lipgloss.AdaptiveColor{Light: "#969B86", Dark: "#696969"}).
			Render(s)
	}

	docStyle = lipgloss.NewStyle().Padding(1, 2, 1, 2)
)

// pulumiProgram is the Pulumi program itself where resources are declared
func pulumiProgram(name string) pulumi.RunFunc {
	return func(ctx *pulumi.Context) error {

		ami, err := ec2.LookupAmi(ctx, &ec2.LookupAmiArgs{
			MostRecent: pulumi.BoolRef(true),
			Filters: []ec2.GetAmiFilter{
				{
					Name: "owner-alias",
					Values: []string{
						"amazon",
					},
				},
				{
					Name:   "name",
					Values: []string{"amzn2-ami-hvm*"},
				},
			},
		}, nil)
		if err != nil {
			return err
		}

		instance, err := ec2.NewInstance(ctx, name, &ec2.InstanceArgs{
			Ami:          pulumi.String(ami.Id),
			InstanceType: pulumi.String("t3.micro"),
			Tags: pulumi.StringMap{
				"Name": pulumi.String(name),
			},
		})
		if err != nil {
			return err
		}

		ctx.Export("instanceId", instance.ID())

		return nil
	}
}

// runPulumiUpdate runs the update or destroy commands based on input.
// It takes as arguments a flag to determine update or destroy, a channel to receive log messages
// and another to receive structured events from the Pulumi Engine.
func runPulumiUpdate(name string, destroy bool, logChannel chan<- logMessage, eventChannel chan<- events.EngineEvent) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()

		projectName := "event-drive-infrastructure"
		// we use a simple stack name here, but recommend using auto.FullyQualifiedStackName for maximum specificity.

		stackName := name
		// stackName := auto.FullyQualifiedStackName("myOrgOrUser", projectName, stackName)

		// create or select a stack matching the specified name and project.
		// this will set up a workspace with everything necessary to run our inline program (deployFunc)
		s, err := auto.UpsertStackInlineSource(ctx, stackName, projectName, pulumiProgram(name))
		if err != nil {
			app.Fatalf("Failed to get stack: %v", err)
		}

		logChannel <- logMessage{msg: fmt.Sprintf("Created/Selected stack %q\n", stackName)}

		w := s.Workspace()

		logChannel <- logMessage{msg: "Installing the AWS plugin"}

		// for inline source programs, we must manage plugins ourselves
		err = w.InstallPlugin(ctx, "aws", "v5.16.0")
		if err != nil {
			app.Fatalf("Failed to install program plugins: %v\n", err)

		}

		logChannel <- logMessage{msg: "Successfully installed Kubernetes plugin"}

		logChannel <- logMessage{msg: "Successfully set config"}
		logChannel <- logMessage{msg: "Running refresh..."}

		_, err = s.Refresh(ctx)
		if err != nil {
			app.Fatalf("Failed to refresh stack: %v\n", err)
		}

		logChannel <- logMessage{msg: "Refresh succeeded!"}

		if destroy {
			logChannel <- logMessage{msg: "Running destroy..."}

			// destroy our stack and exit early
			_, err := s.Destroy(ctx, optdestroy.EventStreams(eventChannel))
			if err != nil {
				fmt.Printf("Failed to destroy stack: %v", err)
			}
			logChannel <- logMessage{msg: "Stack successfully destroyed"}
			return logMessage{msg: "Success"}
		}

		logChannel <- logMessage{msg: "Running update..."}

		res, err := s.Up(ctx, optup.EventStreams(eventChannel))
		if err != nil {
			app.Fatalf("Failed to update stack: %v\n\n", err)
		}

		logChannel <- logMessage{msg: "Update succeeded!"}

		// get the URL from the stack outputs
		id, ok := res.Outputs["instanceId"].Value.(string)
		if !ok {
			fmt.Println("Failed to unmarshal instance id output")
			os.Exit(1)
		}

		logChannel <- logMessage{msg: fmt.Sprintf("Instance ID: %s\n", id)}
		return logMessage{msg: id}
	}
}

// watchForLogMessages forwards any log messages to the `Update` method
func watchForLogMessages(msg chan logMessage) tea.Cmd {
	return func() tea.Msg {
		return <-msg
	}
}

// watchForEvents forwards any engine events to the `Update` method
func watchForEvents(event chan events.EngineEvent) tea.Cmd {
	return func() tea.Msg {
		return <-event
	}
}

type logMessage struct {
	msg string
}

// model is the struct that holds the state for this program
type model struct {
	eventChannel      chan events.EngineEvent // where we'll receive engine events
	logChannel        chan logMessage         // where we'll receive log messages
	spinner           spinner.Model
	destroy           bool
	quitting          bool
	currentMessage    string
	name              string
	updatesInProgress map[string]string // resources with updates in progress
	updatesComplete   map[string]string // resources with updates completed
}

// Init runs any IO needed at the initialization of the program
func (m model) Init() tea.Cmd {
	return tea.Batch(
		watchForLogMessages(m.logChannel),
		runPulumiUpdate(m.name, m.destroy, m.logChannel, m.eventChannel),
		watchForEvents(m.eventChannel),
		spinner.Tick,
	)
}

// Update acts on any events and updates state (model) accordingly
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case events.EngineEvent:
		if msg.ResourcePreEvent != nil {
			m.updatesInProgress[msg.ResourcePreEvent.Metadata.URN] = msg.ResourcePreEvent.Metadata.Type
		}
		if msg.ResOutputsEvent != nil {
			urn := msg.ResOutputsEvent.Metadata.URN
			m.updatesComplete[urn] = msg.ResOutputsEvent.Metadata.Type
			delete(m.updatesInProgress, urn)
		}
		return m, watchForEvents(m.eventChannel) // wait for next event
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case tea.KeyMsg:
		m.quitting = true
		return m, tea.Quit
	case logMessage:
		if msg.msg == "Success" {
			m.currentMessage = "Succeeded!"
			return m, tea.Quit
		}
		if isUrl(msg.msg) {
			m.currentMessage = fmt.Sprintf("Succeeded! %s", msg.msg)
			return m, tea.Quit
		}
		m.currentMessage = msg.msg
		return m, watchForLogMessages(m.logChannel)
	default:
		return m, nil
	}
}

// View displays the state in the terminal
func (m model) View() string {
	var inProgVals []string
	var completedVals []string
	doc := strings.Builder{}
	if len(m.updatesInProgress) > 0 || len(m.updatesComplete) > 0 {
		for _, v := range m.updatesInProgress {
			inProgVals = append(inProgVals, listItem(v))
		}
		sort.Strings(inProgVals)
		for _, v := range m.updatesComplete {
			completedVals = append(completedVals, listDone(v))
		}
		sort.Strings(completedVals)

		inProgVals = append([]string{listHeader("Updates in progress")}, inProgVals...)
		completedVals = append([]string{listHeader("Updates completed")}, completedVals...)
		lists := lipgloss.JoinHorizontal(lipgloss.Top,
			list.Render(
				lipgloss.JoinVertical(lipgloss.Left,
					inProgVals...,
				),
			),
			list.Copy().Width(columnWidth).Render(
				lipgloss.JoinVertical(lipgloss.Left,
					completedVals...,
				),
			),
		)
		doc.WriteString("\n")
		doc.WriteString(lists)
	}

	physicalWidth, _, _ := term.GetSize(int(os.Stdout.Fd()))
	if physicalWidth > 0 {
		docStyle = docStyle.MaxWidth(physicalWidth)
	}

	s := fmt.Sprintf("\n%sCurrent step: %s%s\n", m.spinner.View(), m.currentMessage, docStyle.Render(doc.String()))
	if m.quitting {
		s += "\n"
	}
	return s
}

func main() {
	kingpin.Version("0.0.1")

	var destroy bool

	switch kingpin.MustParse(app.Parse(os.Args[1:])) {
	// Register user
	case deployCmd.FullCommand():
		destroy = false

	// Post message
	case destroyCmd.FullCommand():
		destroy = true
		if *name == "" {
			app.FatalUsage("Must specify a name for destroys")
		}
	}

	var connectionString []string

	// we only got one broker url, so let's check if it's a CSV
	if len(*brokerUrls) == 1 {
		broker := *brokerUrls
		brokerString := strings.NewReader(broker[0])
		r := csv.NewReader(brokerString)
		for {
			record, err := r.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				kingpin.Fatalf("fatal error parsing connection broker urls: %v", err)
			}
			for value := range record {
				connectionString = append(connectionString, record[value])
			}
		}
	} else {
		connectionString = *brokerUrls
	}

	s := spinner.NewModel()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	// consume the kafka message
	reader := NewKafkaReader(connectionString, *topic, "cli")
	defer reader.Close()

	for {
		m, err := reader.ReadMessage(context.Background())
		if err != nil {
			app.Fatalf("Error reading messages: %v", err)
		}

		p := tea.NewProgram(model{
			logChannel:        make(chan logMessage),
			eventChannel:      make(chan events.EngineEvent),
			destroy:           destroy,
			spinner:           s,
			name:              string(m.Value),
			updatesInProgress: map[string]string{},
			updatesComplete:   map[string]string{},
		})

		if p.Start() != nil {
			app.Fatalf("could not start program")
		}

		fmt.Printf("your application has been deployed!")
	}

}

func isUrl(url string) bool {
	_, err := neturl.ParseRequestURI(url)
	if err != nil {
		return false
	}

	u, err := neturl.Parse(url)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}

	return true
}

func NewKafkaReader(brokerUrls []string, topic, groupID string) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokerUrls,
		GroupID:  groupID,
		Topic:    topic,
		MinBytes: 1,    // 1B
		MaxBytes: 10e6, // 10MB
	})
}
