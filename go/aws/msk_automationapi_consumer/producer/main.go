package main

import (
	"context"
	"fmt"
	"math/rand"
	"encoding/csv"
	"time"
	"strings"
	"io"

	petname "github.com/dustinkirkland/golang-petname"
	kafka "github.com/segmentio/kafka-go"
	"gopkg.in/alecthomas/kingpin.v2"
)

var (
	// app = kingpin.New("event-driven-infrastructure", "Create infrastructure from Kafka messages.")
	brokerUrls   = kingpin.Flag("broker-url", "Kafka urls to use for requests").Strings()
	topic        = kingpin.Flag("topic", "Kafka topic to use for requests").String()
	instanceName = kingpin.Flag("instance-name", "name for your EC2 instance").String()
)

func main() {
	kingpin.Version("0.0.1")
	kingpin.Parse()

	fmt.Println("Requesting an EC2 instance")

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

	var name string
	if *instanceName == "" {
		name = GenerateName()
	} else {
		name = *instanceName
	}

	writer := NewKafkaWriter(connectionString, *topic)
	defer writer.Close()

	msg := kafka.Message{
		Key:   []byte("name"),
		Value: []byte(name),
	}

	err := writer.WriteMessages(context.Background(), msg)
	if err != nil {
		fmt.Println(err)
	} else {
		fmt.Println("dispatched request to create EC2 Instance to Kafka", *instanceName)
		fmt.Println("you must consume the message to create the instance")
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

func GenerateName() string {
	// generate some entropy
	rand.Seed(time.Now().UTC().UnixNano())
	return petname.Generate(3, "-")
}
