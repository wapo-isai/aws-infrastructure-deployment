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
import {ParameterVariables} from "./Network";

export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

export enum DatabaseParameterVariables {
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
    applicationEnvironment: ApplicationEnvironment
  ) {
    super(scope, id);

    this.applicationEnvironment = applicationEnvironment;

    const vpcId = ssm.StringParameter.valueFromLookup(
      scope,
      ParameterVariables.PARAMETER_VPC_ID
    );

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

    const username = this.sanitizeDbParameterName(
      applicationEnvironment.prefix("dbUser")
    );

    this.databaseSecret = new Secret(this, "databaseSecret", {
      secretName: this.applicationEnvironment.prefix("DatabaseSecret"),
      description: "Credentials to the RDS instance",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({username: username}),
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
      masterUsername: this.databaseSecret
        .secretValueFromJson("username")
        .unsafeUnwrap(),
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
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_INSTANCE_ID
      )
    );
  }

  static getEndpointAddress(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_ENDPOINT_ADDRESS
      )
    );
  }

  static getEndpointPort(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_ENDPOINT_PORT
      )
    );
  }

  static getDbName(scope: Construct, environment: ApplicationEnvironment) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_DATABASE_NAME
      )
    );
  }

  static getDatabaseSecretArn(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_SECRET_ARN
      )
    );
  }
  static getDatabaseSecurityGroupId(
    scope: Construct,
    environment: ApplicationEnvironment
  ) {
    return ssm.StringParameter.valueFromLookup(
      scope,
      this.createParameterName(
        environment,
        DatabaseParameterVariables.PARAMETER_SECURITY_GROUP_ID
      )
    );
  }

  createOutputParameters() {
    const endpointAddress = new ssm.StringParameter(this, "endpointAddress", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_ENDPOINT_ADDRESS
      ),
      stringValue: this.dbInstance.attrEndpointAddress,
    });

    const endpointPort = new ssm.StringParameter(this, "endpointPort", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_ENDPOINT_PORT
      ),
      stringValue: this.dbInstance.attrEndpointPort,
    });

    const databaseName = new ssm.StringParameter(this, "databaseName", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_DATABASE_NAME
      ),
      stringValue: this.dbInstance.dbName ? this.dbInstance.dbName : "",
    });

    const securityGroupId = new ssm.StringParameter(this, "securityGroupId", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_SECURITY_GROUP_ID
      ),
      stringValue: this.databaseSecurityGroup.attrGroupId,
    });

    const secret = new ssm.StringParameter(this, "secret", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_SECRET_ARN
      ),
      stringValue: this.databaseSecret.secretName,
    });

    const instanceId = new ssm.StringParameter(this, "instanceId", {
      parameterName: this.createParameterName(
        this.applicationEnvironment,
        DatabaseParameterVariables.PARAMETER_INSTANCE_ID
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
