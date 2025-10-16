pipeline {
  parameters {
    booleanParam(name: "RUN_TESTS", defaultValue: true, description: "If enabled, all tests will be run")
    booleanParam(name: "publish", defaultValue: false, description: "Publish to Artifactory")
    booleanParam(name: "publishBeta", defaultValue: false, description: "Publish as beta version")
  }
  agent {
    label "DK_UBCOMMON2404"
  }
  options {
    timestamps()
  }
  environment {
    CI = "true"
    RUN_TESTS = "${params.RUN_TESTS}"
    NODE_AUTH_TOKEN = credentials("npm_publish_token")
    PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.bun/bin"
  }
  stages {
    stage("⚙️  Setup") {
      steps {
        sh "curl -fsSL https://bun.sh/install | bash"
        sh "n lts"
      }
    }
    stage("🏗️  Build") {
      steps {
        sh "bun install --frozen-lockfile"
        sh "bun run api:generate"
        sh "bun run build"
        sh "bun run lint"
        sh "bun run lint:types"
      }
    }
    stage("🧪  Test") {
      when {
        environment name: "RUN_TESTS", value: "true"
      }
      steps {
          sh "bunx playwright install --with-deps"
          sh "bun run test:unit"
          sh "bun run test:e2e"
      }
    }
    stage("📦  Publish Beta") {
      when {
        expression { params.publishBeta == true }
      }
      steps {
        sh 'echo \"//registry.npmjs.org/:_authToken=$NODE_AUTH_TOKEN\" >> .npmrc'
        sh "npm publish --tag beta --access public"
      }
      post {
        failure {
          sh "npm config ls"
          sh "cat /root/.npm/_logs/*.log"
        }
      }
    }
    stage("📦  Publish") {
      when {
        branch "main"
        expression { params.publish == true }
      }
      steps {
        sh 'echo \"//registry.npmjs.org/:_authToken=$NODE_AUTH_TOKEN\" >> .npmrc'
        sh "npm publish --access public"
      }
      post {
        failure {
          sh "npm config ls"
          sh "cat /root/.npm/_logs/*.log"
        }
      }
    }
    stage("📦  Publish (dry-run)") {
      when {
        branch "main"
        expression { params.publish == false }
      }
      steps {
        sh "npm publish --dry-run"
      }
    }
  }
  post {
    success {
      echo "Build succeeeded!"
    }
    unstable {
      echo "Build unstable :/"
    }
    failure {
      echo "Build failed :("
    }
  }
}
