package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/auto"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optup"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	kafka "github.com/segmentio/kafka-go"
	"gopkg.in/alecthomas/kingpin.v2"
)

var (
	app        = kingpin.New("event-driven-infrastructure", "Create infrastructure from Kafka messages.")
	requestCmd = app.Command("request", "Request an EC2 instance.")
	actCmd     = app.Command("act", "Act on a request.")
	destroyCmd = app.Command("destroy", "Destroy an EC2 instance.")

	brokerUrls   = app.Flag("broker-url", "Kafka urls to use for requests").Strings()
	topic        = app.Flag("topic", "Kafka topic to use for requests").String()
	instanceName = app.Flag("instance-name", "name for your EC2 instance").String()

	instanceType = requestCmd.Flag("type", "instance type to request").Default("t3.micro").String()
)

func main() {
	kingpin.Version("0.0.1")

	switch kingpin.MustParse(app.Parse(os.Args[1:])) {
	// Register user
	case requestCmd.FullCommand():
		fmt.Println("Requesting an EC2 instance")

		writer := NewKafkaWriter(*brokerUrls, *topic)
		defer writer.Close()

		msg := kafka.Message{
			Key:   []byte("name"),
			Value: []byte(*instanceName),
		}

		err := writer.WriteMessages(context.Background(), msg)
		if err != nil {
			fmt.Println(err)
		} else {
			fmt.Println("request creation of EC2 instance", *instanceName)
		}

	case actCmd.FullCommand():
		fmt.Println("acting on your request")

		reader := NewKafkaReader(*brokerUrls, *topic, "cli")
		defer reader.Close()

		for {
			m, err := reader.ReadMessage(context.Background())
			if err != nil {
				log.Fatalln(err)
			}
			// fmt.Printf("message at partition:%v offset:%v	%s \n", m.Partition, m.Offset, string(m.Key))
			err = CreateInstance(string(m.Value)) 
			if err != nil {
				app.Fatalf("error creating instance: %v", err)
			}
		}

	// Post message
	case destroyCmd.FullCommand():
		fmt.Println("Destroying an EC2 instance")
	}

}

func NewKafkaWriter(brokerUrls []string, topic string) *kafka.Writer {
	kafkaConfig := kafka.WriterConfig{
		Brokers:  brokerUrls,
		Topic:    topic,
		Balancer: &kafka.Hash{},
	}
	return kafka.NewWriter(kafkaConfig)
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

func pulumiProgram(ctx *pulumi.Context) error {

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

	instance, err := ec2.NewInstance(ctx, "web", &ec2.InstanceArgs{
		Ami:          pulumi.String(ami.Id),
		InstanceType: pulumi.String("t3.micro"),
		Tags: pulumi.StringMap{
			"Name": pulumi.String("HelloWorld"),
		},
	})
	if err != nil {
		return err
	}

	ctx.Export("instanceId", instance.ID())

	return nil
}

func CreateInstance(name string) error {
	ctx := context.Background()

	projectName := "eventDrivenInfrastructure"

	stackName := name

	s, err := auto.UpsertStackInlineSource(ctx, stackName, projectName, pulumiProgram)
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
