#!/usr/bin/env node
import "source-map-support/register";
// import * as cdk from "@aws-cdk/core";
import * as cdk from "aws-cdk-lib";
import {
  DockerRepository,
  DockerRepositoryInputParameters,
  DockerRepositoryStack,
} from "../lib/DockerRepository";

const app: cdk.App = new cdk.App();
const applicationName: string = app.node.tryGetContext("applicationName");
const accountId: string = app.node.tryGetContext("accountId");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};

const dockerRepositoryStack: DockerRepositoryStack = new DockerRepositoryStack(
  app,
  "DockerRepositoryStack",
  {
    stackName: applicationName + "-DockerRepository",
    env: awsEnvironment,
  }
);

const dockerRepositoryInputParameters: DockerRepositoryInputParameters =
  new DockerRepositoryInputParameters(applicationName, accountId);

new DockerRepository(
  dockerRepositoryStack,
  "DockerRepository",
  awsEnvironment,
  dockerRepositoryInputParameters
);

app.synth();
