import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as ecr from "@aws-cdk/aws-ecr";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ec2 from "@aws-cdk/aws-ec2";
import {NetworkOutputParameters, Network} from "./Network";

export class ServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

class Service extends cdk.Construct {
  constructor(
    scope: cdk.Construct,
    id: string,
    awsEnvironment: cdk.Environment,
    applicationEnvironment: ApplicationEnvironment,
    serviceInputParameters: ServiceInputParameters,
    networkOutputParameters: NetworkOutputParameters
  ) {
    super(scope, id);

    const stickySessionConfiguration = [
      {
        key: "stickiness.enabled",
        value: "true",
      },
      {
        key: "stickiness.type",
        value: "lb_cookie",
      },
      {
        key: "stickiness.lb_cookie.duration_seconds",
        value: "3600",
      },
    ];

    const deregistrationDelayConfiguration = [
      {
        key: "deregistration_delay.timeout_seconds",
        value: 5,
      },
    ];

    let targetGroupAtrb: Array<object> = [...deregistrationDelayConfiguration];

    if (serviceInputParameters.stickySessionsEnabled) {
      targetGroupAtrb = [...targetGroupAtrb, ...stickySessionConfiguration];
    }

    const targetGroup = new elbv2.CfnTargetGroup(this, "targetGroup", {
      healthCheckIntervalSeconds:
        serviceInputParameters.healthCheckIntervalSeconds,
      healthCheckPath: serviceInputParameters.healthCheckPath,
      healthCheckPort: serviceInputParameters.containerPort.toString(),
      healthCheckProtocol: serviceInputParameters.containerProtocol,
      healthCheckTimeoutSeconds:
        serviceInputParameters.healthCheckTimeoutSeconds,
      healthyThresholdCount: serviceInputParameters.healthyThresholdCount,
      unhealthyThresholdCount: serviceInputParameters.unhealthyThresholdCount,
      targetGroupAttributes: targetGroupAtrb,
      targetType: "ip",
      port: serviceInputParameters.containerPort,
      protocol: serviceInputParameters.containerProtocol,
      vpcId: networkOutputParameters.vpcId,
    });

    const httpListenerRule = new elbv2.CfnListenerRule(
      this,
      "httpListenerRule",
      {
        actions: [
          {
            type: "forward",
            targetGroupArn: targetGroup.ref,
          },
        ],
        conditions: [
          {
            field: "path-pattern",
            values: ["*"],
          },
        ],
        listenerArn: networkOutputParameters.httpListenerArn,
        priority: 2,
      }
    );

    const logGroup = new logs.LogGroup(this, "ecsLogGroup", {
      logGroupName: applicationEnvironment.prefix("logs"),
      retention: serviceInputParameters.logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ecsTaskExecutionRole = new iam.Role(this, "ecsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
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
    });

    let inlinePolicies = {};

    if (serviceInputParameters.taskRolePolicyStatements.length != 0) {
      inlinePolicies = {
        EcsTaskExecutionRolePolicy: new iam.PolicyDocument({
          statements: [...serviceInputParameters.taskRolePolicyStatements],
        }),
      };
    }

    let policy: iam.RoleProps = {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      path: "/",
      inlinePolicies,
    };

    let role = new iam.Role(this, "ecsTaskRole", policy);

    const ecsTaskRole: iam.Role = role;
    let dockerRepositoryUrl: string = "";

    if (serviceInputParameters.dockerImageSource.isEcrSource()) {
      let dockerRepository = ecr.Repository.fromRepositoryName(
        this,
        "ecrRepository",
        serviceInputParameters.dockerImageSource.getDockerRepositoryName()
      );
      dockerRepository.grantPull(ecsTaskExecutionRole);
      dockerRepositoryUrl = dockerRepository.repositoryUriForTag(
        serviceInputParameters.dockerImageSource.getDockerImageTag()
      );
    } else {
      dockerRepositoryUrl =
        serviceInputParameters.dockerImageSource.dockerImageUrl;
    }

    const containerDefinitionProperty: ecs.CfnTaskDefinition.ContainerDefinitionProperty =
      {
        name: this.containerName(applicationEnvironment),
        cpu: serviceInputParameters.cpu,
        memory: serviceInputParameters.memory,
        image: dockerRepositoryUrl,
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.logGroupName,
            "awslogs-region": awsEnvironment.region
              ? awsEnvironment.region
              : "us-east-1",
            "awslogs-stream-prefix": applicationEnvironment.prefix("stream"),
            "awslogs-datetime-format":
              serviceInputParameters.awslogsDateTimeFormat,
          },
        },
        portMappings: [{containerPort: serviceInputParameters.containerPort}],
        environment: this.toKeyValuePairs(
          serviceInputParameters.environmentVariables
        ),
        stopTimeout: 2,
      };
    const taskDefinition = new ecs.CfnTaskDefinition(this, "taskDefinition", {
      cpu: serviceInputParameters.cpu.toString(),
      memory: serviceInputParameters.memory.toString(),
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: ecsTaskExecutionRole.roleArn,
      taskRoleArn: ecsTaskRole.roleArn,
      containerDefinitions: [containerDefinitionProperty],
    });

    const ecsSecurityGroup: ec2.CfnSecurityGroup = new ec2.CfnSecurityGroup(
      this,
      "ecsSecurityGroup",
      {
        vpcId: networkOutputParameters.vpcId,
        groupDescription: "SecurityGroup for the ECS containers",
      }
    );

    const ecsIngressFromSelf: ec2.CfnSecurityGroupIngress =
      new ec2.CfnSecurityGroupIngress(this, "ecsIngressFromSelf", {
        ipProtocol: "-1",
        sourceSecurityGroupId: ecsSecurityGroup.attrGroupId,
        groupId: ecsSecurityGroup.attrGroupId,
      });

    const ecsIngressFromLoadbalancer: ec2.CfnSecurityGroupIngress =
      new ec2.CfnSecurityGroupIngress(this, "ecsIngressFromLoadbalancer", {
        ipProtocol: "-1",
        sourceSecurityGroupId:
          networkOutputParameters.loadbalancerSecurityGroupId,
        groupId: ecsSecurityGroup.attrGroupId,
      });

    this.allowIngressFromEcs(
      serviceInputParameters.securityGroupIdsToGrantIngressFromEcs,
      ecsSecurityGroup
    );

    const service: ecs.CfnService = new ecs.CfnService(this, "ecsService", {
      cluster: networkOutputParameters.ecsClusterName,
      launchType: "FARGATE",
      deploymentConfiguration: {
        maximumPercent: serviceInputParameters.maximumInstancesPercent,
        minimumHealthyPercent:
          serviceInputParameters.minimumHealthyInstancesPercent,
      },
      desiredCount: serviceInputParameters.desiredInstancesCount,
      taskDefinition: taskDefinition.ref,
      loadBalancers: [
        {
          containerName: this.containerName(applicationEnvironment),
          containerPort: serviceInputParameters.containerPort,
          loadBalancerName: targetGroup.ref,
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          securityGroups: [ecsSecurityGroup.attrGroupId],
          subnets: networkOutputParameters.publicSubnets,
        },
      },
    });

    service.addDependsOn(httpListenerRule);

    applicationEnvironment.tag(this);
  }

  allowIngressFromEcs(
    securityGroupIds: Array<string>,
    ecsSecurityGroup: ec2.CfnSecurityGroup
  ) {
    let i = 1;
    for (
      let securityGroupId = 0;
      securityGroupId < securityGroupIds.length;
      securityGroupId++
    ) {
      let ingress: ec2.CfnSecurityGroupIngress =
        new ec2.CfnSecurityGroupIngress(this, "securityGroupIngress" + i, {
          sourceSecurityGroupId: ecsSecurityGroup.attrGroupId,
          groupId: securityGroupIds[securityGroupId],
          ipProtocol: "-1",
        });
      i++;
    }
  }

  containerName(applicationEnvironment: ApplicationEnvironment) {
    return applicationEnvironment.prefix("container");
  }

  keyValuePair(key: string, value: string) {
    const keyValuePair: ecs.CfnTaskDefinition.KeyValuePairProperty = {
      name: key,
      value: value,
    };

    return keyValuePair;
  }

  // ts.ignore
  toKeyValuePairs(map: object) {
    let keyValuePairs = [];
    for (const entry in Object.keys(map)) {
      // @ts-ignore
      keyValuePairs.push(this.keyValuePair(entry, map[entry]));
    }

    return keyValuePairs;
  }
}

class DockerImageSource {
  dockerImageUrl: string;
  dockerImageTag: string;
  dockerRepositoryName: string;

  constructor(dockerImageUrl: string) {
    this.dockerImageUrl = dockerImageUrl;
    this.dockerImageTag = "";
    this.dockerRepositoryName = "";
  }

  isEcrSource(): boolean {
    return this.dockerRepositoryName != "";
  }

  getDockerRepositoryName(): string {
    return this.dockerRepositoryName;
  }

  getDockerImageTag(): string {
    return this.dockerImageTag;
  }

  getDockerImageUrl(): string {
    return this.dockerImageUrl;
  }
}

class ServiceInputParameters {
  dockerImageSource: DockerImageSource;
  environmentVariables: object;
  securityGroupIdsToGrantIngressFromEcs: Array<string>;
  taskRolePolicyStatements: Array<iam.PolicyStatement>;
  healthCheckIntervalSeconds: number;
  healthCheckPath: string;
  containerPort: number;
  containerProtocol: string;
  healthCheckTimeoutSeconds: number;
  healthyThresholdCount: number;
  unhealthyThresholdCount: number;
  logRetention = logs.RetentionDays.ONE_WEEK;
  cpu: number;
  memory: number;
  desiredInstancesCount: number;
  maximumInstancesPercent: number;
  minimumHealthyInstancesPercent: number;
  stickySessionsEnabled: boolean;
  awslogsDateTimeFormat: string;

  constructor(
    dockerImageSource: DockerImageSource,
    environmentVariables: object
  ) {
    this.dockerImageSource = dockerImageSource;
    this.environmentVariables = environmentVariables;
    this.securityGroupIdsToGrantIngressFromEcs = [];
  }

  withHealthCheckIntervalSeconds(healthCheckIntervalSeconds: number): number {
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
  withContainerProtocol(containerProtocol: string): string {
    this.containerProtocol = containerProtocol;
    return containerProtocol;
  }
  withHealthCheckTimeoutSeconds(healthCheckTimeoutSeconds: number): number {
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
  withStickySessionsEnabled(stickySessionsEnabled: boolean): boolean {
    this.stickySessionsEnabled = stickySessionsEnabled;
    return stickySessionsEnabled;
  }
  withAwsLogsDateTimeFormat(awslogsDateTimeFormat: string): string {
    this.awslogsDateTimeFormat = awslogsDateTimeFormat;
    return awslogsDateTimeFormat;
  }
}

class ApplicationEnvironment {
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

  toString() {
    return this.environmentName + "-" + this.applicationName;
  }

  prefix(inputString: string) {
    return this + "-" + inputString;
  }

  prefixV2(inputString: string, characterLimit: number) {
    let name = this + "-" + inputString;
    if (name.length <= characterLimit) {
      return name;
    }
    return name.substring(name.length - characterLimit);
  }

  tag(construct: cdk.IConstruct) {
    cdk.Tags.of(construct).add("environment", this.environmentName);
    cdk.Tags.of(construct).add("application", this.applicationName);
  }
}

let applicationEnvironment = new ApplicationEnvironment("", "");

const app = new cdk.App();

const environmentName: string = app.node.tryGetContext("environmentName");
const applicationName: string = app.node.tryGetContext("applicationName");
const accountId: string = app.node.tryGetContext("accountId");
const springProfile: string = app.node.tryGetContext("springProfile");
const dockerImageUrl: string = app.node.tryGetContext("dockerImageUrl");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};

const serviceStack = new ServiceStack(app, "ServiceStack", {
  stackName: applicationEnvironment.prefix("Service"),
  env: awsEnvironment,
});

const dockerImageSource = new DockerImageSource(dockerImageUrl);

const networkOutputParameters = Network.getOutputParametersFromParameterStore(
  serviceStack,
  applicationEnvironment.getEnvironmentName()
);

const serviceInputParameters = new ServiceInputParameters(
  dockerImageSource,
  environmentVariables(springProfile)
);

serviceInputParameters.withHealthCheckIntervalSeconds(30);

new Service(
  serviceStack,
  "Service",
  awsEnvironment,
  applicationEnvironment,
  serviceInputParameters,
  networkOutputParameters
);

function environmentVariables(springProfile: string) {
  let obj = {
    "SPRING_PROFILES_ACTIVE": springProfile,
  };

  return obj;
}
