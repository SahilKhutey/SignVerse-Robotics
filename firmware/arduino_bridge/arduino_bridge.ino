#include <Servo.h>

Servo shoulderServo;
Servo elbowServo;
Servo wristServo;

// Configuration Pins
const int SHOULDER_PIN = 9;
const int ELBOW_PIN = 10;
const int WRIST_PIN = 11;

String inputString = "";
bool stringComplete = false;

void setup() {
  Serial.begin(115200);
  
  shoulderServo.attach(SHOULDER_PIN);
  elbowServo.attach(ELBOW_PIN);
  wristServo.attach(WRIST_PIN);
  
  // Home position
  shoulderServo.write(90);
  elbowServo.write(90);
  wristServo.write(90);
  
  inputString.reserve(50);
}

void loop() {
  // If a full string terminating with '\n' arrived
  if (stringComplete) {
    parseAndExecute(inputString);
    inputString = "";
    stringComplete = false;
  }
}

void serialEvent() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    inputString += inChar;
    if (inChar == '\n') {
      stringComplete = true;
    }
  }
}

void parseAndExecute(String payload) {
  // Payload Format: "90,45,180"
  int firstComma = payload.indexOf(',');
  int secondComma = payload.indexOf(',', firstComma + 1);
  
  if (firstComma > 0 && secondComma > firstComma) {
    String sStr = payload.substring(0, firstComma);
    String eStr = payload.substring(firstComma + 1, secondComma);
    String wStr = payload.substring(secondComma + 1);
    
    int sAngle = sStr.toInt();
    int eAngle = eStr.toInt();
    int wAngle = wStr.toInt();
    
    // Safety boundaries before physical write
    sAngle = constrain(sAngle, 0, 180);
    eAngle = constrain(eAngle, 20, 160);
    wAngle = constrain(wAngle, 0, 180);
    
    shoulderServo.write(sAngle);
    elbowServo.write(eAngle);
    wristServo.write(wAngle);
  }
}
