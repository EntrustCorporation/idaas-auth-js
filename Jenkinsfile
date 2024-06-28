pipeline {
  parameters {
    booleanParam(name: "RUN_TESTS", defaultValue: true, description: "If enabled, all tests will be run")
    booleanParam(name: "publish", defaultValue: false, description: "Publish to Artifactory")
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
    NPM_CONFIG__AUTH = credentials("246abfdf-d036-4ed3-ada8-c24975556e65")
    NPM_CONFIG_EMAIL = "builder@entrustdatacard.com"
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
        sh "bun run ci"
      }
    }
    stage("🧪  Test") {
      when {
        environment name: "RUN_TESTS", value: "true"
      }
      steps {
          sh "bun test --bail"
      }
    }
    stage("📦  Publish") {
      when {
        branch "main"
        expression { params.publish == true }
      }
      steps {
        sh "npm publish --registry https://binary.entrust.com:8443/artifactory/api/npm/npm-snapshot-local/"
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
