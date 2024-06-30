import * as cdk from "aws-cdk-lib/core";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import {Construct, IConstruct} from "constructs";
import {NetworkOutputParameters, ParameterVariables} from "./Network";
import {PrivateDnsNamespace} from "aws-cdk-lib/aws-servicediscovery";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

export class Service extends Construct {
  vpc: ec2.IVpc;
  usersDockerRepositoryUrl: string;
  ordersDockerRepositoryUrl: string;
  productsDockerRepositoryUrl: string;
  ecsCluster: ecs.ICluster;

  constructor(
    scope: Construct,
    id: string,
    awsEnvironment: cdk.Environment,
    applicationEnvironment: ApplicationEnvironment,
    serviceInputParameters: ServiceInputParameters,
    networkOutputParameters: NetworkOutputParameters,
    productsDockerRepositoryUrl: string,
    ordersDockerRepositoryUrl: string,
    usersDockerRepositoryUrl: string
  ) {
    super(scope, id);

    this.usersDockerRepositoryUrl = usersDockerRepositoryUrl;
    this.ordersDockerRepositoryUrl = ordersDockerRepositoryUrl;
    this.productsDockerRepositoryUrl = productsDockerRepositoryUrl;

    const vpcId = ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_VPC_ID
    );

    this.vpc = ec2.Vpc.fromLookup(this, "ImportedVpc", {
      vpcId: vpcId,
    });

    const clusterName = networkOutputParameters.ecsClusterName;

    this.ecsCluster = ecs.Cluster.fromClusterAttributes(
      this,
      "FromClusterName",
      {
        clusterName: clusterName,
        vpc: this.vpc,
      }
    );

    const logGroup: logs.LogGroup = new logs.LogGroup(this, "ecsLogGroup", {
      logGroupName: applicationEnvironment.prefix("logs"),
      retention: serviceInputParameters.logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ecsTaskExecutionRole: iam.Role = new iam.Role(
      this,
      "ecsTaskExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonECSTaskExecutionRolePolicy"
          ),
          iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
        ],
        path: "/",
        inlinePolicies: {
          EcsTaskExecutionRolePolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: ["*"],
                actions: [
                  "ecr:GetAuthorizationToken",
                  "ecr:BatchCheckLayerAvailability",
                  "ecr:GetDownloadUrlForLayer",
                  "ecr:BatchGetImage",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents",
                ],
              }),
            ],
          }),
        },
      }
    );

    let inlinePolicies = {};

    if (serviceInputParameters.taskRolePolicyStatements.length != 0) {
      inlinePolicies = {
        EcsTaskExecutionRolePolicy: new iam.PolicyDocument({
          statements: [...serviceInputParameters.taskRolePolicyStatements],
        }),
      };
    }

    const policy: iam.RoleProps = {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      path: "/",
      inlinePolicies,
    };

    const ecsTaskRole: iam.Role = new iam.Role(this, "ecsTaskRole", policy);

    const firstTaskDefinition: ecs.TaskDefinition = new ecs.TaskDefinition(
      this,
      "firstTaskDefinition",
      {
        compatibility: ecs.Compatibility.FARGATE,
        cpu: "1024",
        memoryMiB: "2048",
        networkMode: ecs.NetworkMode.AWS_VPC,
        executionRole: ecsTaskExecutionRole,
        taskRole: ecsTaskRole,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
        },
      }
    );

    const secondTaskDefinition: ecs.TaskDefinition = new ecs.TaskDefinition(
      this,
      "secondTaskDefinition",
      {
        compatibility: ecs.Compatibility.FARGATE,
        cpu: "1024",
        memoryMiB: "2048",
        networkMode: ecs.NetworkMode.AWS_VPC,
        executionRole: ecsTaskExecutionRole,
        taskRole: ecsTaskRole,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
        },
      }
    );

    const thirdTaskDefinition: ecs.TaskDefinition = new ecs.TaskDefinition(
      this,
      "thirdTaskDefinition",
      {
        compatibility: ecs.Compatibility.FARGATE,
        cpu: "1024",
        memoryMiB: "2048",
        networkMode: ecs.NetworkMode.AWS_VPC,
        executionRole: ecsTaskExecutionRole,
        taskRole: ecsTaskRole,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
        },
      }
    );

    const namespace = new PrivateDnsNamespace(this, "ServiceNamespace", {
      name: "local",
      vpc: this.vpc,
    });

    const firstContainer = firstTaskDefinition.addContainer(
      "ProductContainer",
      {
        containerName: applicationEnvironment.prefix("product-container"),
        image: ecs.ContainerImage.fromRegistry(
          this.productsDockerRepositoryUrl
        ),
        cpu: serviceInputParameters.cpu,
        memoryLimitMiB: serviceInputParameters.memory,
        portMappings: [{containerPort: 8080, name: "product-port-mapping"}],
        environment: serviceInputParameters.environmentVariables,
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: "demoLogs",
          logGroup: logGroup,
        }),
      }
    );

    const secondContainer = secondTaskDefinition.addContainer(
      "OrdersContainer",
      {
        containerName: applicationEnvironment.prefix("orders-container"),
        image: ecs.ContainerImage.fromRegistry(this.ordersDockerRepositoryUrl),
        cpu: serviceInputParameters.cpu,
        memoryLimitMiB: serviceInputParameters.memory,
        portMappings: [{containerPort: 8081, name: "order-port-mapping"}],
        environment: serviceInputParameters.environmentVariables,
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: "demoLogs",
          logGroup: logGroup,
        }),
      }
    );

    const thirdContainer = thirdTaskDefinition.addContainer("UsersContainer", {
      containerName: applicationEnvironment.prefix("users-container"),
      image: ecs.ContainerImage.fromRegistry(this.usersDockerRepositoryUrl),
      cpu: serviceInputParameters.cpu,
      memoryLimitMiB: serviceInputParameters.memory,
      portMappings: [{containerPort: 8082, name: "user-port-mapping"}],
      environment: serviceInputParameters.environmentVariables,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "demoLogs",
        logGroup: logGroup,
      }),
    });

    const ecsSecurityGroup: ec2.SecurityGroup = new ec2.SecurityGroup(
      this,
      "ecsSecurityGroup",
      {
        vpc: this.vpc,
        allowAllOutbound: true,
      }
    );

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080));

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8081));

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8082));

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8080));

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8081));

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8082));

    const ecsIngressFromSelf: ec2.CfnSecurityGroupIngress =
      new ec2.CfnSecurityGroupIngress(this, "ecsIngressFromSelf", {
        ipProtocol: "-1",
        sourceSecurityGroupId: ecsSecurityGroup.securityGroupId,
        groupId: ecsSecurityGroup.securityGroupId,
      });

    const ecsIngressFromLoadbalancer: ec2.CfnSecurityGroupIngress =
      new ec2.CfnSecurityGroupIngress(this, "ecsIngressFromLoadbalancer", {
        ipProtocol: "-1",
        sourceSecurityGroupId:
          networkOutputParameters.loadbalancerSecurityGroupId,
        groupId: networkOutputParameters.loadbalancerSecurityGroupId,
      });

    this.allowIngressFromEcs(
      serviceInputParameters.securityGroupIdsToGrantIngressFromEcs,
      ecsSecurityGroup
    );

    const firstService: ecs.FargateService = new ecs.FargateService(
      this,
      "firstEcsService",
      {
        cluster: this.ecsCluster,
        taskDefinition: firstTaskDefinition,
        desiredCount: serviceInputParameters.desiredInstancesCount,
        securityGroups: [ecsSecurityGroup],
        maxHealthyPercent: serviceInputParameters.maximumInstancesPercent,
        minHealthyPercent:
          serviceInputParameters.minimumHealthyInstancesPercent,
        assignPublicIp: true,
        serviceConnectConfiguration: {
          namespace: namespace.namespaceName,
          services: [
            {
              portMappingName: "product-port-mapping",
              dnsName: "products.local",
              port: 8080,
              discoveryName: "products",
            },
          ],
        },
      }
    );

    const secondService: ecs.FargateService = new ecs.FargateService(
      this,
      "secondEcsService",
      {
        cluster: this.ecsCluster,
        taskDefinition: secondTaskDefinition,
        desiredCount: serviceInputParameters.desiredInstancesCount,
        securityGroups: [ecsSecurityGroup],
        maxHealthyPercent: serviceInputParameters.maximumInstancesPercent,
        minHealthyPercent:
          serviceInputParameters.minimumHealthyInstancesPercent,
        assignPublicIp: true,
        serviceConnectConfiguration: {
          namespace: namespace.namespaceName,
          services: [
            {
              portMappingName: "order-port-mapping",
              dnsName: "orders.local",
              port: 8081,
              discoveryName: "orders",
            },
          ],
        },
      }
    );

    const thirdService: ecs.FargateService = new ecs.FargateService(
      this,
      "thirdEcsService",
      {
        cluster: this.ecsCluster,
        taskDefinition: thirdTaskDefinition,
        desiredCount: serviceInputParameters.desiredInstancesCount,
        securityGroups: [ecsSecurityGroup],
        maxHealthyPercent: serviceInputParameters.maximumInstancesPercent,
        minHealthyPercent:
          serviceInputParameters.minimumHealthyInstancesPercent,
        assignPublicIp: true,
        serviceConnectConfiguration: {
          namespace: namespace.namespaceName,
          services: [
            {
              portMappingName: "user-port-mapping",
              dnsName: "users.local",
              port: 8082,
              discoveryName: "users",
            },
          ],
        },
      }
    );

    const firstTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "firstTargetGroup",
      {
        targets: [firstService],
        protocol: serviceInputParameters.containerProtocol,
        vpc: this.vpc,
        port: 8080,
        deregistrationDelay: cdk.Duration.seconds(30),
        healthCheck: {
          path: serviceInputParameters.healthCheckPath,
          healthyThresholdCount: serviceInputParameters.healthyThresholdCount,
          unhealthyThresholdCount:
            serviceInputParameters.unhealthyThresholdCount,
          interval: serviceInputParameters.healthCheckIntervalSeconds,
          timeout: serviceInputParameters.healthCheckTimeoutSeconds,
          healthyHttpCodes: "200",
          port: serviceInputParameters.containerPort.toString(),
        },
      }
    );

    const secondTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "secondTargetGroup",
      {
        targets: [secondService],
        protocol: serviceInputParameters.containerProtocol,
        vpc: this.vpc,
        port: 8081,
        deregistrationDelay: cdk.Duration.seconds(30),
        healthCheck: {
          path: serviceInputParameters.healthCheckPath,
          healthyThresholdCount: serviceInputParameters.healthyThresholdCount,
          unhealthyThresholdCount:
            serviceInputParameters.unhealthyThresholdCount,
          interval: serviceInputParameters.healthCheckIntervalSeconds,
          timeout: serviceInputParameters.healthCheckTimeoutSeconds,
          healthyHttpCodes: "200",
        },
      }
    );

    const thirdTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "thirdTargetGroup",
      {
        targets: [thirdService],
        protocol: serviceInputParameters.containerProtocol,
        vpc: this.vpc,
        port: 8082,
        deregistrationDelay: cdk.Duration.seconds(30),
        healthCheck: {
          path: serviceInputParameters.healthCheckPath,
          healthyThresholdCount: serviceInputParameters.healthyThresholdCount,
          unhealthyThresholdCount:
            serviceInputParameters.unhealthyThresholdCount,
          interval: serviceInputParameters.healthCheckIntervalSeconds,
          timeout: serviceInputParameters.healthCheckTimeoutSeconds,
          healthyHttpCodes: "200",
        },
      }
    );

    const firstActionProperty: elbv2.CfnListenerRule.ActionProperty = {
      targetGroupArn: firstTargetGroup.targetGroupArn,
      type: "forward",
    };

    const secondActionProperty: elbv2.CfnListenerRule.ActionProperty = {
      targetGroupArn: secondTargetGroup.targetGroupArn,
      type: "forward",
    };

    const thirdActionProperty: elbv2.CfnListenerRule.ActionProperty = {
      targetGroupArn: thirdTargetGroup.targetGroupArn,
      type: "forward",
    };

    const firstCondition: elbv2.CfnListenerRule.RuleConditionProperty = {
      field: "path-pattern",
      values: ["/products"],
    };

    const secondCondition: elbv2.CfnListenerRule.RuleConditionProperty = {
      field: "path-pattern",
      values: ["/orders"],
    };

    const thirdCondition: elbv2.CfnListenerRule.RuleConditionProperty = {
      field: "path-pattern",
      values: ["/users"],
    };

    const firstHttpListenerRule = new elbv2.CfnListenerRule(
      this,
      "firstHttpListenerRule",
      {
        actions: [firstActionProperty],
        listenerArn: networkOutputParameters.httpListenerArn,
        conditions: [firstCondition],
        priority: 2,
      }
    );

    const secondHttpListenerRule = new elbv2.CfnListenerRule(
      this,
      "secondHttpListenerRule",
      {
        actions: [secondActionProperty],
        listenerArn: networkOutputParameters.httpListenerArn,
        conditions: [secondCondition],
        priority: 3,
      }
    );

    const thirdHttpListenerRule = new elbv2.CfnListenerRule(
      this,
      "thirdHttpListenerRule",
      {
        actions: [thirdActionProperty],
        listenerArn: networkOutputParameters.httpListenerArn,
        conditions: [thirdCondition],
        priority: 4,
      }
    );

    applicationEnvironment.tag(this);

    secondService.node.addDependency(firstService);
    thirdService.node.addDependency(secondService);
  }

  allowIngressFromEcs(
    securityGroupIds: Array<string>,
    ecsSecurityGroup: ec2.SecurityGroup
  ) {
    let i = 1;
    for (
      let securityGroupId = 0;
      securityGroupId < securityGroupIds.length;
      securityGroupId++
    ) {
      new ec2.CfnSecurityGroupIngress(this, "securityGroupIngress" + i, {
        sourceSecurityGroupId: ecsSecurityGroup.securityGroupId,
        groupId: securityGroupIds[securityGroupId],
        ipProtocol: "-1",
      });
      i++;
    }
  }

  containerName(applicationEnvironment: ApplicationEnvironment) {
    return applicationEnvironment.prefix("container");
  }
}

export class ServiceInputParameters {
  environmentVariables: {[key: string]: string};
  securityGroupIdsToGrantIngressFromEcs: Array<string>;
  taskRolePolicyStatements: Array<iam.PolicyStatement>;
  healthCheckIntervalSeconds: cdk.Duration;
  healthCheckPath: string;
  containerPort: number;
  containerProtocol: elbv2.ApplicationProtocol;
  healthCheckTimeoutSeconds: cdk.Duration;
  healthyThresholdCount: number;
  unhealthyThresholdCount: number;
  logRetention: logs.RetentionDays;
  cpu: number;
  memory: number;
  desiredInstancesCount: number;
  maximumInstancesPercent: number;
  minimumHealthyInstancesPercent: number;

  constructor(
    environmentVariables: {[key: string]: string},
    securityGroupIdsToGrantIngressFromEcs: Array<string>
  ) {
    this.environmentVariables = environmentVariables;
    this.securityGroupIdsToGrantIngressFromEcs =
      securityGroupIdsToGrantIngressFromEcs;
  }

  withHealthCheckIntervalSeconds(
    healthCheckIntervalSeconds: cdk.Duration
  ): cdk.Duration {
    this.healthCheckIntervalSeconds = healthCheckIntervalSeconds;
    return healthCheckIntervalSeconds;
  }
  withHealthCheckPath(healthCheckPath: string): string {
    this.healthCheckPath = healthCheckPath;
    return healthCheckPath;
  }

  withContainerPort(containerPort: number): number {
    this.containerPort = containerPort;
    return containerPort;
  }
  withContainerProtocol(containerProtocol: elbv2.ApplicationProtocol): string {
    this.containerProtocol = containerProtocol;
    return containerProtocol;
  }
  withHealthCheckTimeoutSeconds(
    healthCheckTimeoutSeconds: cdk.Duration
  ): cdk.Duration {
    this.healthCheckTimeoutSeconds = healthCheckTimeoutSeconds;
    return healthCheckTimeoutSeconds;
  }
  withHealthyThresholdCount(healthyThresholdCount: number): number {
    this.healthyThresholdCount = healthyThresholdCount;
    return healthyThresholdCount;
  }
  withUnhealthyThresholdCount(unhealthyThresholdCount: number): number {
    this.unhealthyThresholdCount = unhealthyThresholdCount;
    return unhealthyThresholdCount;
  }
  withCpu(cpu: number): number {
    this.cpu = cpu;
    return cpu;
  }
  withMemory(memory: number): number {
    this.memory = memory;
    return memory;
  }
  withLogRetention(logRetention: logs.RetentionDays): logs.RetentionDays {
    this.logRetention = logRetention;
    return logRetention;
  }
  withDesiredInstances(desiredInstancesCount: number): number {
    this.desiredInstancesCount = desiredInstancesCount;
    return desiredInstancesCount;
  }
  withMaximumInstancesPercent(maximumInstancesPercent: number): number {
    this.maximumInstancesPercent = maximumInstancesPercent;
    return maximumInstancesPercent;
  }
  withMinimumHealthyInstancesPercent(
    minimumHealthyInstancesPercent: number
  ): number {
    this.minimumHealthyInstancesPercent = minimumHealthyInstancesPercent;
    return minimumHealthyInstancesPercent;
  }
  withTaskRolePolicyStatements(
    taskRolePolicyStatements: Array<iam.PolicyStatement>
  ): Array<iam.PolicyStatement> {
    this.taskRolePolicyStatements = taskRolePolicyStatements;
    return taskRolePolicyStatements;
  }
}

export class ApplicationEnvironment {
  applicationName: string;
  environmentName: string;
  constructor(applicationName: string, environmentName: string) {
    this.applicationName = applicationName;
    this.environmentName = environmentName;
  }

  getApplicationName() {
    return this.applicationName;
  }

  getEnvironmentName() {
    return this.environmentName;
  }

  sanitize(environmentName: string) {
    return environmentName.replace(/[^a-zA-Z0-9]/g, "");
  }

  toString() {
    return this.environmentName + "-" + this.applicationName;
  }

  prefix(inputString: string) {
    return (
      this.environmentName + "-" + this.applicationName + "-" + inputString
    );
  }

  prefixV2(inputString: string, characterLimit: number) {
    let name =
      this.environmentName + "-" + this.applicationName + "-" + inputString;
    if (name.length <= characterLimit) {
      return name;
    }
    return name.substring(0, name.length - characterLimit);
  }

  tag(construct: IConstruct) {
    cdk.Tags.of(construct).add("environment", this.environmentName);
    cdk.Tags.of(construct).add("application", this.applicationName);
  }
}
