#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import {Construct} from "constructs";

import {
  ApplicationEnvironment,
  ServiceInputParameters,
  ServiceStack,
  Service,
} from "../lib/Service";
import {Network, NetworkOutputParameters} from "../lib/Network";
import {Database, DatabaseOutputParameters} from "../lib/Database";

const app: cdk.App = new cdk.App();

const environmentName: string = app.node.tryGetContext("environmentName");
const applicationName: string = app.node.tryGetContext("applicationName");
const accountId: string = app.node.tryGetContext("accountId");
const springProfile: string = app.node.tryGetContext("springProfile");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};

const applicationEnvironment: ApplicationEnvironment =
  new ApplicationEnvironment(applicationName, environmentName);

const serviceStack: ServiceStack = new ServiceStack(app, "ServiceStack", {
  stackName: applicationEnvironment.prefix("Service"),
  env: awsEnvironment,
});

const productsDockerImageUrl: string = app.node.tryGetContext(
  "productsDockerImageUrl"
);
const ordersDockerImageUrl: string = app.node.tryGetContext(
  "ordersDockerImageUrl"
);
const usersDockerImageUrl: string = app.node.tryGetContext(
  "usersDockerImageUrl"
);

const networkOutputParameters: NetworkOutputParameters =
  Network.getOutputParametersFromParameterStore(
    serviceStack,
    applicationEnvironment.getEnvironmentName()
  );

const databaseOutputParameters: DatabaseOutputParameters =
  Database.getOutputParametersFromParameterStore(
    serviceStack,
    applicationEnvironment
  );

const serviceInputParameters: ServiceInputParameters =
  new ServiceInputParameters(
    environmentVariables(serviceStack, springProfile),
    [databaseOutputParameters.databaseSecurityGroupId]
  );

serviceInputParameters.withContainerPort(8080);
serviceInputParameters.withHealthCheckPath("/");
serviceInputParameters.withHealthCheckIntervalSeconds(cdk.Duration.seconds(10));
serviceInputParameters.withContainerProtocol(elbv2.ApplicationProtocol.HTTP);
serviceInputParameters.withHealthCheckTimeoutSeconds(cdk.Duration.seconds(5));
serviceInputParameters.withHealthyThresholdCount(2);
serviceInputParameters.withUnhealthyThresholdCount(3);
serviceInputParameters.withCpu(512);
serviceInputParameters.withMemory(1024);
serviceInputParameters.withLogRetention(logs.RetentionDays.ONE_WEEK);
serviceInputParameters.withDesiredInstances(1);
serviceInputParameters.withMaximumInstancesPercent(200);
serviceInputParameters.withMinimumHealthyInstancesPercent(50);
serviceInputParameters.withTaskRolePolicyStatements([]);

new Service(
  serviceStack,
  "Service",
  awsEnvironment,
  applicationEnvironment,
  serviceInputParameters,
  networkOutputParameters,
  productsDockerImageUrl,
  ordersDockerImageUrl,
  usersDockerImageUrl
);

function environmentVariables(scope: Construct, springProfile: string) {
  const databaseSecretArn: string = databaseOutputParameters.databaseSecretArn;
  const databaseSecret: secrets.ISecret = secrets.Secret.fromSecretCompleteArn(
    scope,
    "databaseSecret",
    "arn:aws:secretsmanager:us-east-1:590184053459:secret:prod-brewed-awakening-DatabaseSecret-mfmO5N"
  );

  const envVars = {
    "SPRING_PROFILES_ACTIVE": springProfile,
    "HOST_NAME": databaseOutputParameters.endpointAddress,
    "DATABASE_PORT": databaseOutputParameters.endpointPort,
    "DATABASE_NAME": databaseOutputParameters.dbName,
    "DATABASE_USER_NAME": databaseSecret
      .secretValueFromJson("username")
      .unsafeUnwrap(),
    "DATABASE_USER_PASSWORD": databaseSecret
      .secretValueFromJson("password")
      .unsafeUnwrap(),
  };

  return envVars;
}

app.synth();
