pipeline{
 agent any

 environment{   
    APP_NAME = "eximia-chatbotv2"
    IMAGE_TAG = "latest"
    CONTAINER_NAME ="eximia-chatbotv2"
    PORT = "3000"
 }

 stages{
    stage('Clone Repository'){
        steps{
            echo'obterndo codigo'
            checkout scm
        }
    }
    stage('Buld Docker Image'){
        steps{
            echo 'Gerando imagem'
            sh '''docker build -t ${APP_NAME}:${IMAGE_TAG} .'''
        
        }
    }
    stage('Deploy'){
        steps{
            sh '''
        cd /opt/eximia.chatbot
        docker compose down
        docker compose up -d --build
        '''
        }
    }
    
 }
}