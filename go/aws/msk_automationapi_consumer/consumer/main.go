package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/auto"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optup"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	kafka "github.com/segmentio/kafka-go"
	"gopkg.in/alecthomas/kingpin.v2"
)

var (
	// app = kingpin.New("event-driven-infrastructure", "Create infrastructure from Kafka messages.")
	brokerUrls = kingpin.Flag("broker-url", "Kafka urls to use for requests").Strings()
	topic      = kingpin.Flag("topic", "Kafka topic to use for requests").String()
)

func main() {
	kingpin.Version("0.0.1")
	kingpin.Parse()

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

	// create a kafka reader
	reader := NewKafkaReader(connectionString, *topic, "cli")
	defer reader.Close()

	// okay we're waiting for new message
	fmt.Println("waiting for kafka messages")

	// start a continous loop and extract messages from the kafka queue
	for {
		m, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Fatalln(err)
		}
		fmt.Printf("request for EC2 instance named: %s found at partition: %v\n", string(m.Value), m.Partition)
		// if we get a message, create an EC2 instance with the name we randomly generated
		// from the producer
		err = CreateInstance(string(m.Value))
		if err != nil {
			log.Fatalf("error creating instance: %v", err)
		}
	}

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

// the Pulumi automation API program
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

// the actual pulumi instantiator
func CreateInstance(name string) error {
	ctx := context.Background()

	projectName := "eventDrivenInfrastructure"

	stackName := name

	s, err := auto.UpsertStackInlineSource(ctx, stackName, projectName, pulumiProgram(name))
	if err != nil {
		return err
	}
	w := s.Workspace()

	err = w.InstallPlugin(ctx, "aws", "v5.16.0")
	if err != nil {
		return err
	}

	s.SetConfig(ctx, "aws:region", auto.ConfigValue{Value: "us-west-2"})
	stdoutStreamer := optup.ProgressStreams(os.Stdout)

	res, err := s.Up(ctx, stdoutStreamer)

	if err != nil {
		return err
	}

	id, _ := res.Outputs["instanceId"].Value.(string)
	fmt.Printf("Created Instance: %s\n", id)

	return nil
}
