#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {Database, DatabaseStack} from "../lib/Database";
import {ApplicationEnvironment} from "../lib/Service";

const app: cdk.App = new cdk.App();

const environmentName: string = app.node.tryGetContext("environmentName");
const accountId: string = app.node.tryGetContext("accountId");
const region: string = app.node.tryGetContext("region");
const awsEnvironment: cdk.Environment = {account: accountId, region};
const applicationName: string = app.node.tryGetContext("applicationName");

const applicationEnvironment: ApplicationEnvironment =
  new ApplicationEnvironment(applicationName, environmentName);

const databaseStack: DatabaseStack = new DatabaseStack(app, "DatabaseStack", {
  stackName: applicationEnvironment.prefix("Database"),
  env: awsEnvironment,
});

new Database(databaseStack, "Database", applicationEnvironment);

app.synth();
