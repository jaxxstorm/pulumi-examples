package main

import (
	"fmt"
	"strings"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/msk"
	"github.com/pulumi/pulumi-kafka/sdk/v3/go/kafka"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		slug := fmt.Sprintf("jaxxstorm/vpc_tailscale_vpn/%v", ctx.Stack())

		vpc, err := pulumi.NewStackReference(ctx, slug, nil)
		if err != nil {
			return fmt.Errorf("error getting vpc stack reference: %w", err)
		}

		sg, err := ec2.NewSecurityGroup(ctx, "example", &ec2.SecurityGroupArgs{
			VpcId: vpc.GetStringOutput(pulumi.String("vpcId")),
			Ingress: ec2.SecurityGroupIngressArray{
				ec2.SecurityGroupIngressArgs{
					Protocol:   pulumi.String("-1"),
					FromPort:   pulumi.Int(0),
					ToPort:     pulumi.Int(0),
					CidrBlocks: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("error creating security group: %v", err)
		}

		privateSubnets := vpc.GetOutput(pulumi.String("privateSubnetIds")).ApplyT(
			func(subnets interface{}) []string {
				subnetsArray := subnets.([]interface{}) // what on earth?
				var s []string
				for _, subnet := range subnetsArray {
					s = append(s, subnet.(string))
				}
				return s
			},
		).(pulumi.StringArrayOutput)

		cluster, err := msk.NewCluster(ctx, "example", &msk.ClusterArgs{
			KafkaVersion:        pulumi.String("3.2.0"),
			NumberOfBrokerNodes: pulumi.Int(3),
			BrokerNodeGroupInfo: &msk.ClusterBrokerNodeGroupInfoArgs{
				InstanceType:  pulumi.String("kafka.m5.large"),
				ClientSubnets: privateSubnets,
				StorageInfo: &msk.ClusterBrokerNodeGroupInfoStorageInfoArgs{
					EbsStorageInfo: &msk.ClusterBrokerNodeGroupInfoStorageInfoEbsStorageInfoArgs{
						VolumeSize: pulumi.Int(100),
					},
				},
				SecurityGroups: pulumi.StringArray{
					sg.ID(),
				},
			},
			EncryptionInfo: &msk.ClusterEncryptionInfoArgs{
				EncryptionInTransit: &msk.ClusterEncryptionInfoEncryptionInTransitArgs{
					ClientBroker: pulumi.String("TLS_PLAINTEXT"),
				},
			},
			Tags: pulumi.StringMap{
				"Owner": pulumi.String("lbriggs"),
				"owner": pulumi.String("lbriggs"),
			},
		})
		if err != nil {
			return fmt.Errorf("error creating MSK cluster: %v", err)
		}

		// ctx.Export("zookeeperConnectString", cluster.ZookeeperConnectString)
		ctx.Export("bootstrapBrokersTls", cluster.BootstrapBrokersTls)

		kafkaProvider, err := kafka.NewProvider(ctx, "example", &kafka.ProviderArgs{
			BootstrapServers: cluster.BootstrapBrokersTls.ApplyT(func(csv string) []string {
				v := strings.Split(csv, ",")
				return v
			}).(pulumi.StringArrayOutput),
			SkipTlsVerify: pulumi.Bool(true),
		})

		if err != nil {
			return fmt.Errorf("error creating Kafka provider: %v", err)
		}

		topic, err := kafka.NewTopic(ctx, "example", &kafka.TopicArgs{
			Partitions:        pulumi.Int(3),
			ReplicationFactor: pulumi.Int(3),
			Config: pulumi.Map{
				"cleanup.policy": pulumi.Any("compact"),
				"segment.ms":     pulumi.Any("20000"),
			},
		}, pulumi.Provider(kafkaProvider))
		if err != nil {
			return fmt.Errorf("error creating Kafka topic: %v", err)
		}

		ctx.Export("topicName", topic.Name)

		return nil
	})
}
