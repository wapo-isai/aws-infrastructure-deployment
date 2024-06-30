import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as ecs from "aws-cdk-lib/aws-ecs";
import {Construct} from "constructs";

export enum ParameterVariables {
  PARAMETER_VPC_ID = "vpcId",
  PARAMETER_HTTP_LISTENER = "httpListenerArn",
  PARAMETER_LOADBALANCER_SECURITY_GROUP_ID = "loadBalancerSecurityGroupId",
  PARAMETER_ECS_CLUSTER_NAME = "ecsClusterName",
  PARAMETER_ISOLATED_SUBNET_ONE = "isolatedSubnetIdOne",
  PARAMETER_ISOLATED_SUBNET_TWO = "isolatedSubnetIdTwo",
  PARAMETER_PUBLIC_SUBNET_ONE = "publicSubnetIdOne",
  PARAMETER_PUBLIC_SUBNET_TWO = "publicSubnetIdTwo",
  PARAMETER_AVAILABILITY_ZONE_ONE = "availabilityZoneOne",
  PARAMETER_AVAILABILITY_ZONE_TWO = "availabilityZoneTwo",
  PARAMETER_LOAD_BALANCER_ARN = "loadBalancerArn",
  PARAMETER_LOAD_BALANCER_DNS_NAME = "loadBalancerDnsName",
  PARAMETER_LOAD_BALANCER_HOSTED_ZONE_ID = "loadBalancerCanonicalHostedZoneId",
}
export interface NetworkOutputParameters {
  vpcId: string;
  httpListenerArn: string;
  loadbalancerSecurityGroupId: string;
  ecsClusterName: string;
  isolatedSubnets: Array<string>;
  publicSubnets: Array<string>;
  availabilityZones: Array<string>;
  loadBalancerArn: string;
  loadBalancerDnsName: string;
  loadBalancerCanonicalHostedZoneId: string;
}

export class NetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

export class Network extends Construct {
  vpc: ec2.IVpc;
  environmentName: string;
  ecsCluster: ecs.ICluster;
  httpListener: elbv2.IApplicationListener;
  loadbalancerSecurityGroup: ec2.ISecurityGroup;
  loadBalancer: elbv2.IApplicationLoadBalancer;

  constructor(
    scope: Construct,
    id: string,
    awsEnvironment: cdk.Environment,
    environmentName: string
  ) {
    super(scope, id);
    this.environmentName = environmentName;

    // Create a VPC with 2 private and 2 public subnets
    this.vpc = new ec2.Vpc(this, "vpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: this.prefixWithEnvironmentName("publicSubnet"),
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: this.prefixWithEnvironmentName("isolatedSubnet"),
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.ecsCluster = new ecs.Cluster(this, "cluster", {
      vpc: this.vpc,
      clusterName: this.prefixWithEnvironmentName("ecsCluster"),
    });

    // Create a security group for the load balancer
    this.loadbalancerSecurityGroup = new ec2.SecurityGroup(
      this,
      "LbSecurityGroup",
      {
        vpc: this.vpc,
        securityGroupName: this.prefixWithEnvironmentName(
          "loadbalancerSecurityGroup"
        ),
        description: "Public access to the load balancer.",
      }
    );

    this.loadbalancerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80)
    );

    this.loadbalancerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80)
    );

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "loadbalancer",
      {
        vpc: this.vpc,
        loadBalancerName: this.prefixWithEnvironmentName("loadbalancer"),
        internetFacing: true,
        deletionProtection: false,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: this.loadbalancerSecurityGroup,
        vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      }
    );

    const dummyTargetGroup: elbv2.ApplicationTargetGroup =
      new elbv2.ApplicationTargetGroup(this, "defaultTargetGroup", {
        vpc: this.vpc,
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetGroupName: this.prefixWithEnvironmentName("no-op-targetGroup"),
        targetType: elbv2.TargetType.IP,
        deregistrationDelay: cdk.Duration.seconds(5),
        healthCheck: {
          healthyThresholdCount: 2,
          interval: cdk.Duration.seconds(10),
          timeout: cdk.Duration.seconds(5),
        },
      });

    this.httpListener = this.loadBalancer.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    this.httpListener.addTargetGroups("http-defaultTargetGroup", {
      targetGroups: [dummyTargetGroup],
    });

    this.createOutputParameters();
  }

  createOutputParameters() {
    const vpcId = new ssm.StringParameter(this, "vpcId", {
      stringValue: this.vpc.vpcId,
      parameterName: ParameterVariables.PARAMETER_VPC_ID,
    });
    const httpListener = new ssm.StringParameter(this, "httpListener", {
      stringValue: this.httpListener.listenerArn,
      parameterName: ParameterVariables.PARAMETER_HTTP_LISTENER,
    });
    const loadbalancerSecurityGroup = new ssm.StringParameter(
      this,
      "loadBalancerSecurityGroupId",
      {
        stringValue: this.loadbalancerSecurityGroup.securityGroupId,
        parameterName:
          ParameterVariables.PARAMETER_LOADBALANCER_SECURITY_GROUP_ID,
      }
    );
    const cluster = new ssm.StringParameter(this, "ecsClusterName", {
      stringValue: this.ecsCluster.clusterName,
      parameterName: ParameterVariables.PARAMETER_ECS_CLUSTER_NAME,
    });
    const availabilityZoneOne = new ssm.StringParameter(
      this,
      "availabilityZoneOne",
      {
        stringValue: this.vpc.availabilityZones[0],
        parameterName: ParameterVariables.PARAMETER_AVAILABILITY_ZONE_ONE,
      }
    );
    const availabilityZoneTwo = new ssm.StringParameter(
      this,
      "availabilityZoneTwo",
      {
        stringValue: this.vpc.availabilityZones[1],
        parameterName: ParameterVariables.PARAMETER_AVAILABILITY_ZONE_TWO,
      }
    );
    const isolatedSubnetOne = new ssm.StringParameter(
      this,
      "isolatedSubnetOne",
      {
        stringValue: this.vpc.isolatedSubnets[0].subnetId,
        parameterName: ParameterVariables.PARAMETER_ISOLATED_SUBNET_ONE,
      }
    );
    const isolatedSubnetTwo = new ssm.StringParameter(
      this,
      "isolatedSubnetTwo",
      {
        stringValue: this.vpc.isolatedSubnets[1].subnetId,
        parameterName: ParameterVariables.PARAMETER_ISOLATED_SUBNET_TWO,
      }
    );
    const publicSubnetOne = new ssm.StringParameter(this, "publicSubnetOne", {
      stringValue: this.vpc.publicSubnets[0].subnetId,
      parameterName: ParameterVariables.PARAMETER_PUBLIC_SUBNET_ONE,
    });
    const publicSubnetTwo = new ssm.StringParameter(this, "publicSubnetTwo", {
      stringValue: this.vpc.publicSubnets[1].subnetId,
      parameterName: ParameterVariables.PARAMETER_PUBLIC_SUBNET_TWO,
    });
    const loadBalancerArn = new ssm.StringParameter(this, "loadBalancerArn", {
      stringValue: this.loadBalancer.loadBalancerArn,
      parameterName: ParameterVariables.PARAMETER_LOAD_BALANCER_ARN,
    });
    const loadBalancerDnsName = new ssm.StringParameter(
      this,
      "loadBalancerDnsName",
      {
        stringValue: this.loadBalancer.loadBalancerDnsName,
        parameterName: ParameterVariables.PARAMETER_LOAD_BALANCER_DNS_NAME,
      }
    );
    const loadBalancerCanonicalHostedZoneId = new ssm.StringParameter(
      this,
      "loadBalancerCanonicalHostedZoneId",
      {
        stringValue: this.loadBalancer.loadBalancerCanonicalHostedZoneId,
        parameterName:
          ParameterVariables.PARAMETER_LOAD_BALANCER_HOSTED_ZONE_ID,
      }
    );
  }

  prefixWithEnvironmentName(inputString: string): string {
    return this.environmentName + "-" + inputString;
  }

  static createParameterName(environmentName: string, parameterName: string) {
    return environmentName + "-Network-" + parameterName;
  }

  static getOutputParametersFromParameterStore(
    scope: Construct,
    environmentName: string
  ): NetworkOutputParameters {
    let networkParams: NetworkOutputParameters = {
      vpcId: this.getVpcIdFromParameterStore(scope, environmentName),
      httpListenerArn: this.getHttpListenerArnFromParameterStore(
        scope,
        environmentName
      ),
      loadbalancerSecurityGroupId:
        this.getLoadbalancerSecurityGroupIdFromParameterStore(
          scope,
          environmentName
        ),
      ecsClusterName: this.getEcsClusterNameFromParameterStore(
        scope,
        environmentName
      ),
      isolatedSubnets: this.getIsolatedSubnetsFromParameterStore(
        scope,
        environmentName
      ),
      publicSubnets: this.getPublicSubnetsFromParameterStore(
        scope,
        environmentName
      ),
      availabilityZones: this.getAvailabilityZonesFromParameterStore(
        scope,
        environmentName
      ),
      loadBalancerArn: this.getLoadBalancerArnFromParameterStore(
        scope,
        environmentName
      ),
      loadBalancerDnsName: this.getLoadBalancerDnsNameFromParameterStore(
        scope,
        environmentName
      ),
      loadBalancerCanonicalHostedZoneId:
        this.getLoadBalancerCanonicalHostedZoneIdFromParameterStore(
          scope,
          environmentName
        ),
    };
    return networkParams;
  }
  static getVpcIdFromParameterStore(scope: Construct, environmentName: string) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_VPC_ID
    );
  }

  static getHttpListenerArnFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_HTTP_LISTENER
    );
  }

  static getLoadbalancerSecurityGroupIdFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_LOADBALANCER_SECURITY_GROUP_ID
    );
  }
  static getEcsClusterNameFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_ECS_CLUSTER_NAME
    );
  }
  static getIsolatedSubnetsFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_ISOLATED_SUBNET_ONE
      ),
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_ISOLATED_SUBNET_TWO
      ),
    ];
  }
  static getPublicSubnetsFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_PUBLIC_SUBNET_ONE
      ),
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_PUBLIC_SUBNET_TWO
      ),
    ];
  }
  static getAvailabilityZonesFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_AVAILABILITY_ZONE_ONE
      ),
      ssm.StringParameter.valueFromLookup(
        scope,
        ParameterVariables.PARAMETER_AVAILABILITY_ZONE_TWO
      ),
    ];
  }
  static getLoadBalancerArnFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_ARN
    );
  }
  static getLoadBalancerDnsNameFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_DNS_NAME
    );
  }
  static getLoadBalancerCanonicalHostedZoneIdFromParameterStore(
    scope: Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_HOSTED_ZONE_ID
    );
  }
}
