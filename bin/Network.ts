#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {Network, NetworkStack} from "../lib/Network";

const app: cdk.App = new cdk.App();

const environmentName: string = app.node.tryGetContext("environmentName");
const accountId: string = app.node.tryGetContext("accountId");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};

const networkStack: NetworkStack = new NetworkStack(app, "NetworkStack", {
  stackName: environmentName + "-Network",
  env: awsEnvironment,
});

new Network(networkStack, "Network", awsEnvironment, environmentName);

app.synth();
