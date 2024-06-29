import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ssm from "aws-cdk-lib/aws-ssm";

import {Construct} from "constructs";
import {
  ISecret,
  Secret,
  CfnSecretTargetAttachment,
} from "aws-cdk-lib/aws-secretsmanager";
import {ApplicationEnvironment} from "./Service";
import {Network, NetworkOutputParameters} from "./Network";

export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

enum ParameterVariables {
  PARAMETER_ENDPOINT_ADDRESS = "endpointAddress",
  PARAMETER_ENDPOINT_PORT = "endpointPort",
  PARAMETER_DATABASE_NAME = "databaseName",
  PARAMETER_SECURITY_GROUP_ID = "securityGroupId",
  PARAMETER_SECRET_ARN = "secretArn",
  PARAMETER_INSTANCE_ID = "instanceId",
}

export interface DatabaseOutputParameters {
  endpointAddress: string;
  endpointPort: string;
  dbName: string;
  databaseSecretArn: string;
  databaseSecurityGroupId: string;
  instanceId: string;
}

export class Database extends Construct {
  databaseSecurityGroup: ec2.CfnSecurityGroup;
  dbInstance: rds.CfnDBInstance;
  databaseSecret: ISecret;
  applicationEnvironment: ApplicationEnvironment;
  vpc: ec2.IVpc;

  constructor(
    scope: Construct,
    id: string,
    awsEnvironment: cdk.Environment,
    applicationEnvironment: ApplicationEnvironment,
    databaseInputParameters: DatabaseInputParameters
  ) {
    super(scope, id);

    this.applicationEnvironment = applicationEnvironment;

    const networkOutputParameters: NetworkOutputParameters =
      Network.getOutputParametersFromParameterStore(
        this,
        applicationEnvironment.getEnvironmentName()
      );

    const vpcId = networkOutputParameters.vpcId;

    this.vpc = ec2.Vpc.fromLookup(this, "ImportedVpc", {
      vpcId: vpcId,
    });

    this.databaseSecurityGroup = new ec2.CfnSecurityGroup(
      this,
      "databaseSecurityGroup",
      {
        vpcId: this.vpc.vpcId,
        groupDescription: "Security Group for the database instance",
        groupName: this.applicationEnvironment.prefix("dbSecurityGroup"),
      }
    );

    this.databaseSecret = new Secret(this, "databaseSecret", {
      secretName: this.applicationEnvironment.prefix("DatabaseSecret"),
      description: "Credentials to the RDS instance",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({username: "postgres"}),
        generateStringKey: "password",
        passwordLength: 32,
        excludeCharacters: '/@"',
      },
    });

    const subnetGroup = new rds.CfnDBSubnetGroup(this, "dbSubnetGroup", {
      dbSubnetGroupDescription: "Subnet group for the RDS instance",
      dbSubnetGroupName: this.applicationEnvironment.prefix("dbSubnetGroup"),
      subnetIds: [
        this.vpc.isolatedSubnets[0].subnetId,
        this.vpc.isolatedSubnets[1].subnetId,
      ],
    });

    const username = this.sanitizeDbParameterName(
      applicationEnvironment.prefix("dbUser")
    );

    this.dbInstance = new rds.CfnDBInstance(this, "postgresInstance", {
      dbInstanceIdentifier: this.applicationEnvironment.prefix("database"),
      allocatedStorage: "20",
      availabilityZone: this.vpc.availabilityZones[0],
      dbInstanceClass: "db.t3.micro",
      dbName: this.sanitizeDbParameterName(
        this.applicationEnvironment.prefix("brewedawakeningDB")
      ),
      dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
      engine: "postgres",
      engineVersion: "16.3",
      masterUsername: username,
      masterUserPassword: this.databaseSecret
        .secretValueFromJson("password")
        .unsafeUnwrap(),
      publiclyAccessible: false,
      vpcSecurityGroups: [this.databaseSecurityGroup.attrGroupId],
    });

    new CfnSecretTargetAttachment(this, "secretTargetAttachment", {
      secretId: this.databaseSecret.secretArn,
      targetId: this.dbInstance.ref,
      targetType: "AWS::RDS::DBInstance",
    });

    this.createOutputParameters();
  }

  sanitizeDbParameterName(dbParameterName: string) {
    return dbParameterName.replace(/[^a-zA-Z0-9]/g, "");
  }

  static createParameterName(
    applicationEnvironment: ApplicationEnvironment,
    parameterName: string
  ): string {
    return (
      applicationEnvironment.getEnvironmentName() +
      "-" +
      applicationEnvironment.getApplicationName() +
      "-Database-" +
      parameterName
    );
  }

  static getOutputParametersFromParameterStore(
    scope: Construct,
    environment: ApplicationEnvironment
  ): DatabaseOutputParameters {
    return {
      endpointAddress: this.getEndpointAddress(scope, environment),
      endpointPort: this.getEndpointPort(scope, environment),
      dbName: this.getDbName(scope, environment),
      databaseSecretArn: this.getDatabaseSecretArn(scope, environment),
      databaseSecurityGroupId: this.getDatabaseSecurityGroupId(
        scope,
        environment
      ),
      instanceId: this.getDatabaseIdentifier(scope, environment),
    };
  }

  static getDatabaseIdentifier(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_INSTANCE_ID,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_INSTANCE_ID
      )
    ).stringValue;
  }

  static getEndpointAddress(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_ENDPOINT_ADDRESS,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_ENDPOINT_ADDRESS
      )
    ).stringValue;
  }

  static getEndpointPort(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_ENDPOINT_PORT,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_ENDPOINT_PORT
      )
    ).stringValue;
  }

  static getDbName(scope: Construct, environment: ApplicationEnvironment) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_DATABASE_NAME,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_DATABASE_NAME
      )
    ).stringValue;
  }

  static getDatabaseSecretArn(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_SECRET_ARN,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_SECRET_ARN
      )
    ).stringValue;
  }
  static getDatabaseSecurityGroupId(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.fromStringParameterName(
      scope,
      ParameterVariables.PARAMETER_SECURITY_GROUP_ID,
      this.createParameterName(
        environment,
        ParameterVariables.PARAMETER_SECURITY_GROUP_ID
      )
    ).stringValue;
  }

  createOutputParameters() {
    const endpointAddress = new ssm.StringParameter(this, "endpointAddress", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_ENDPOINT_ADDRESS
      ),
      stringValue: this.dbInstance.attrEndpointAddress,
    });

    const endpointPort = new ssm.StringParameter(this, "endpointPort", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_ENDPOINT_PORT
      ),
      stringValue: this.dbInstance.attrEndpointPort,
    });

    const databaseName = new ssm.StringParameter(this, "databaseName", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_DATABASE_NAME
      ),
      stringValue: this.dbInstance.dbName ? this.dbInstance.dbName : "",
    });

    const securityGroupId = new ssm.StringParameter(this, "securityGroupId", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_SECURITY_GROUP_ID
      ),
      stringValue: this.databaseSecurityGroup.attrGroupId,
    });

    const secret = new ssm.StringParameter(this, "secret", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_SECRET_ARN
      ),
      stringValue: this.databaseSecret.secretArn,
    });

    const instanceId = new ssm.StringParameter(this, "instanceId", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        ParameterVariables.PARAMETER_INSTANCE_ID
      ),
      stringValue: this.dbInstance.dbInstanceIdentifier
        ? this.dbInstance.dbInstanceIdentifier
        : "",
    });
  }

  createParameterName(
    applicationEnvironment: ApplicationEnvironment,
    parameterName: string
  ) {
    return (
      applicationEnvironment.getEnvironmentName() +
      "-" +
      applicationEnvironment.getApplicationName() +
      "-Database-" +
      parameterName
    );
  }
}

class DatabaseInputParameters {
  storageInGb: number = 20;
  instanceClass: string = "db.t3.micro";
  postgresVersion: string = "16.3";

  withStorageInGb(storageInGb: number) {
    this.storageInGb = storageInGb;
  }
  withInstanceClass(instanceClass: string) {
    this.instanceClass = instanceClass;
  }
  withPostgresVersion(postgresVersion: string) {
    this.postgresVersion = postgresVersion;
  }
}
