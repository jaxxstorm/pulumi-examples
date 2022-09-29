package main

import (
	"context"
	"fmt"
	"log"

	kafka "github.com/segmentio/kafka-go"
)

var BrokerURLs = []string{
	"b-1.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
	"b-2.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
	"b-3.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
}

func getKafkaReader(topic, groupID string) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:  BrokerURLs,
		GroupID:  groupID,
		Topic:    topic,
		MinBytes: 1, // 1B
		MaxBytes: 10e6, // 10MB
	})
}

func main() {

	topic := "example-1f7b169"
	groupID := "consumer"

	reader := getKafkaReader(topic, groupID)

	defer reader.Close()

	fmt.Println("start consuming ... !!")
	for {
		m, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Fatalln(err)
		}
		fmt.Printf("message at partition:%v offset:%v	%s \n", m.Partition, m.Offset, string(m.Key))
	}
}