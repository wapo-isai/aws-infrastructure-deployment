#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  ApplicationEnvironment,
  DockerImageSource,
  ServiceInputParameters,
  ServiceStack,
  Service,
} from "../lib/Service";
import {Network, NetworkOutputParameters} from "../lib/Network";

const app: cdk.App = new cdk.App();

const environmentName: string = app.node.tryGetContext("environmentName");
const applicationName: string = app.node.tryGetContext("applicationName");
const accountId: string = app.node.tryGetContext("accountId");
const springProfile: string = app.node.tryGetContext("springProfile");
const dockerImageUrl: string = app.node.tryGetContext("dockerImageUrl");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};

const applicationEnvironment: ApplicationEnvironment =
  new ApplicationEnvironment(applicationName, environmentName);

const serviceStack: ServiceStack = new ServiceStack(app, "ServiceStack", {
  stackName: applicationEnvironment.prefix("Service"),
  env: awsEnvironment,
});

const dockerImageSource: DockerImageSource = new DockerImageSource(
  dockerImageUrl
);

const networkOutputParameters: NetworkOutputParameters =
  Network.getOutputParametersFromParameterStore(
    serviceStack,
    applicationEnvironment.getEnvironmentName()
  );

const serviceInputParameters: ServiceInputParameters =
  new ServiceInputParameters(
    dockerImageSource,
    environmentVariables(springProfile)
  );

serviceInputParameters.withHealthCheckIntervalSeconds(30);

function environmentVariables(springProfile: string) {
  const obj = {
    "SPRING_PROFILES_ACTIVE": springProfile,
  };

  return obj;
}

new Service(
  serviceStack,
  "Service",
  awsEnvironment,
  applicationEnvironment,
  serviceInputParameters,
  networkOutputParameters
);

app.synth();
