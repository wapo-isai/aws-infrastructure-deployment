import * as cdk from "@aws-cdk/core";
import * as ecr from "@aws-cdk/aws-ecr";
import * as iam from "@aws-cdk/aws-iam";

export class DockerRepositoryStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

class DockerRepository extends cdk.Construct {
  ecrRepository: ecr.IRepository;
  constructor(
    scope: cdk.Construct,
    id: string,
    awsEnvironment: cdk.Environment,
    dockerRepositoryInputParameters: DockerRepositoryInputParameters
  ) {
    super(scope, id);

    this.ecrRepository = new ecr.Repository(this, "ecrRepository", {
      repositoryName: dockerRepositoryInputParameters.dockerRepositoryName,
      removalPolicy: dockerRepositoryInputParameters.retainRegistryOnDelete
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          rulePriority: 1,
          description:
            "limit to " +
            dockerRepositoryInputParameters.maxImageCount +
            " images",
          maxImageCount: dockerRepositoryInputParameters.maxImageCount,
        },
      ],
    });

    this.ecrRepository.grantPullPush(
      new iam.AccountPrincipal(dockerRepositoryInputParameters.accountId)
    );
  }
}

class DockerRepositoryInputParameters {
  dockerRepositoryName: string;
  accountId: string;
  maxImageCount: number;
  retainRegistryOnDelete: boolean;

  constructor(dockerRepositoryName: string, accountId: string) {
    this.dockerRepositoryName = dockerRepositoryName;
    this.accountId = accountId;
    this.maxImageCount = 10;
    this.retainRegistryOnDelete = false;
  }
}

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
