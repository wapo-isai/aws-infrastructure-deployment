import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import {Construct} from "constructs";

export class DockerRepositoryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

export class DockerRepository extends Construct {
  ecrRepository: ecr.IRepository;
  constructor(
    scope: Construct,
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

export class DockerRepositoryInputParameters {
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
