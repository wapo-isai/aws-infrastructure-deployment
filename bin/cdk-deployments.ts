#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import {CdkDeploymentsStack} from "../lib/cdk-deployments-stack";

const app = new cdk.App();
new CdkDeploymentsStack(app, "CdkDeploymentsStack", {});
