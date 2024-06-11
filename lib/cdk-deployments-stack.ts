import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class CdkDeploymentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, "CdkDeploymentsQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
    });
  }
}
