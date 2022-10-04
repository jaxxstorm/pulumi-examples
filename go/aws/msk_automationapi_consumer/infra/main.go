package main

import (
	"fmt"
	"strings"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	xec2 "github.com/pulumi/pulumi-awsx/sdk/go/awsx/ec2"
	awstailscale "github.com/lbrlabs/pulumi-aws-tailscalebastion/sdk/go/bastion"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/msk"
	"github.com/pulumi/pulumi-kafka/sdk/v3/go/kafka"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		cidr := "172.20.0.0/22"
		vpc, err := xec2.NewVpc(ctx, "msk", &xec2.VpcArgs{
			CidrBlock: &cidr,
			Tags: pulumi.StringMap{
				"Owner": pulumi.String("lbriggs"),
				"owner": pulumi.String("lbriggs"),
			},
		})
		if err != nil {
			return fmt.Errorf("error creating vpc: %v", err)
		}

		_, err = awstailscale.NewBastion(ctx, "msk", &awstailscale.BastionArgs{
			VpcId: vpc.VpcId,
			SubnetIds: vpc.PrivateSubnetIds,
			Route: pulumi.String("172.20.0.0/22"),
			Region: pulumi.String("us-west-2"),
		})
		if err != nil {
			return fmt.Errorf("error creating bastion host: %v", err)
		}

		sg, err := ec2.NewSecurityGroup(ctx, "msk-security-group", &ec2.SecurityGroupArgs{
			VpcId: vpc.VpcId,
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

		cluster, err := msk.NewCluster(ctx, "msk", &msk.ClusterArgs{
			KafkaVersion:        pulumi.String("3.2.0"),
			NumberOfBrokerNodes: pulumi.Int(3),
			BrokerNodeGroupInfo: &msk.ClusterBrokerNodeGroupInfoArgs{
				InstanceType:  pulumi.String("kafka.m5.large"),
				ClientSubnets: vpc.PrivateSubnetIds,
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
		ctx.Export("bootstrapBrokers", cluster.BootstrapBrokers)

		kafkaProvider, err := kafka.NewProvider(ctx, "msk", &kafka.ProviderArgs{
			BootstrapServers: cluster.BootstrapBrokersTls.ApplyT(func(csv string) []string {
				v := strings.Split(csv, ",")
				return v
			}).(pulumi.StringArrayOutput),
			SkipTlsVerify: pulumi.Bool(true),
		}, pulumi.DependsOn([]pulumi.Resource{cluster}))

		if err != nil {
			return fmt.Errorf("error creating Kafka provider: %v", err)
		}

		topic, err := kafka.NewTopic(ctx, "msk", &kafka.TopicArgs{
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
		ctx.Export("info", cluster.ConfigurationInfo)

		return nil
	})
}
