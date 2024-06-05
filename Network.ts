import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as ssm from "@aws-cdk/aws-ssm";
import * as ecs from "@aws-cdk/aws-ecs";

enum ParameterVariables {
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

class NetworkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

export class Network extends cdk.Construct {
  vpc: ec2.IVpc;
  environmentName: string;
  ecsCluster: ecs.ICluster;
  httpListener: elbv2.IApplicationListener;
  loadbalancerSecurityGroup: ec2.ISecurityGroup;
  loadBalancer: elbv2.IApplicationLoadBalancer;

  constructor(
    scope: cdk.Construct,
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

    const ingressFromPublic = new ec2.CfnSecurityGroupIngress(
      this,
      "ingressToLoadbalancer",
      {
        groupId: this.loadbalancerSecurityGroup.securityGroupId,
        cidrIp: "0.0.0.0/0",
        ipProtocol: "-1",
      }
    );

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "loadbalancer",
      {
        loadBalancerName: this.prefixWithEnvironmentName("loadbalancer"),
        vpc: this.vpc,
        internetFacing: true,
        securityGroup: this.loadbalancerSecurityGroup,
      }
    );

    const dummyTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "targetgroup",
      {
        vpc: this.vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetGroupName: this.prefixWithEnvironmentName("no-op-targetGroup"),
        targetType: elbv2.TargetType.IP,
        deregistrationDelay: cdk.Duration.seconds(5),
        healthCheck: {
          healthyThresholdCount: 2,
          interval: cdk.Duration.seconds(10),
          timeout: cdk.Duration.seconds(5),
        },
      }
    );

    const httpListener = this.loadBalancer.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    httpListener.addTargetGroups("http-defaultTargetGroup", {
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
    scope: cdk.Construct,
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
  static getVpcIdFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_VPC_ID,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_VPC_ID
      )
    ).stringValue;
  }

  static getHttpListenerArnFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_HTTP_LISTENER,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_HTTP_LISTENER
      )
    ).stringValue;
  }

  static getLoadbalancerSecurityGroupIdFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_LOADBALANCER_SECURITY_GROUP_ID,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_LOADBALANCER_SECURITY_GROUP_ID
      )
    ).stringValue;
  }
  static getEcsClusterNameFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_ECS_CLUSTER_NAME,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_ECS_CLUSTER_NAME
      )
    ).stringValue;
  }
  static getIsolatedSubnetsFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_ISOLATED_SUBNET_ONE,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_ISOLATED_SUBNET_ONE
        )
      ).stringValue,
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_ISOLATED_SUBNET_TWO,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_ISOLATED_SUBNET_TWO
        )
      ).stringValue,
    ];
  }
  static getPublicSubnetsFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_PUBLIC_SUBNET_ONE,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_PUBLIC_SUBNET_ONE
        )
      ).stringValue,
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_PUBLIC_SUBNET_TWO,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_PUBLIC_SUBNET_TWO
        )
      ).stringValue,
    ];
  }
  static getAvailabilityZonesFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return [
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_AVAILABILITY_ZONE_ONE,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_AVAILABILITY_ZONE_ONE
        )
      ).stringValue,
      ssm.StringParameter.fromStringParameterName(
        scope,
        ParameterVariables.PARAMETER_AVAILABILITY_ZONE_TWO,
        this.createParameterName(
          environmentName,
          ParameterVariables.PARAMETER_AVAILABILITY_ZONE_TWO
        )
      ).stringValue,
    ];
  }
  static getLoadBalancerArnFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_ARN,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_LOAD_BALANCER_ARN
      )
    ).stringValue;
  }
  static getLoadBalancerDnsNameFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_DNS_NAME,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_LOAD_BALANCER_DNS_NAME
      )
    ).stringValue;
  }
  static getLoadBalancerCanonicalHostedZoneIdFromParameterStore(
    scope: cdk.Construct,
    environmentName: string
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_LOAD_BALANCER_HOSTED_ZONE_ID,
      this.createParameterName(
        environmentName,
        ParameterVariables.PARAMETER_LOAD_BALANCER_HOSTED_ZONE_ID
      )
    ).stringValue;
  }
}
const app = new cdk.App();

let environmentName: string = app.node.tryGetContext("environmentName");
let accountId: string = app.node.tryGetContext("accountId");
let region: string = app.node.tryGetContext("region");
let awsEnvironment: cdk.Environment = {account: accountId, region};

const networkStack: NetworkStack = new NetworkStack(app, "NetworkStack", {
  stackName: environmentName + "-Network",
  env: awsEnvironment,
});

new Network(networkStack, "Network", awsEnvironment, environmentName);
