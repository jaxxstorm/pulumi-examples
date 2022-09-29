package main

import (
	"context"
	"math/rand"
	"fmt"
	"time"

	"github.com/google/uuid"
	kafka "github.com/segmentio/kafka-go"
)

var BrokerURLs = []string{
	"b-1.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
	"b-2.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
	"b-3.example65bcf29.jo580c.c14.kafka.us-west-2.amazonaws.com:9092",
}

func newKafkaWriter(kafkaURL []string, topic string) *kafka.Writer {
	kafkaConfig := kafka.WriterConfig{
		Brokers:  BrokerURLs,
		Topic:    topic,
		Balancer: &kafka.Hash{},
	}
	return kafka.NewWriter(kafkaConfig)
}

func main() {

	kafkaURL := BrokerURLs
	topic := "example-1f7b169"


	writer := newKafkaWriter(kafkaURL, topic)
	defer writer.Close()
	fmt.Println("start producing ... !!")

	for i := 0; ; i++ {
		keyval := rand.Intn(3)
		key := fmt.Sprintf("Key-%d", keyval)
		msg := kafka.Message{
			Key:   []byte(key),
			Value: []byte(fmt.Sprint(uuid.New())),
		}
		err := writer.WriteMessages(context.Background(), msg)
		if err != nil {
			fmt.Println(err)
		} else {
			fmt.Println("produced", key)
		}
		time.Sleep(1 * time.Second)
	}
}
