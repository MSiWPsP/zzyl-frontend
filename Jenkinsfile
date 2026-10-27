pipeline {
    agent any
    options { timestamps() }
    parameters {
        string(name: 'DOCKER_TAG', defaultValue: 'latest', description: 'Docker image tag')
        string(name: 'BACKEND_URL', defaultValue: 'http://host.docker.internal:8080', description: 'Backend URL reachable from the container')
        string(name: 'FRONTEND_PORT', defaultValue: '9901', description: 'Host HTTP port')
    }
    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Build') {
            steps {
                sh 'docker build -t "zzyl-vue:$DOCKER_TAG" .'
            }
        }
        stage('Deploy') {
            steps {
                sh 'sh ./deploy.sh zzyl-vue "$DOCKER_TAG"'
            }
        }
    }
}
