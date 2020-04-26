/*
  Web client

 This sketch connects to a website (http://www.google.com)
 using an Arduino Wiznet Ethernet shield.

 Circuit:
 * Ethernet shield attached to pins 10, 11, 12, 13

 created 18 Dec 2009
 by David A. Mellis
 modified 9 Apr 2012
 by Tom Igoe, based on work by Adrian McEwen

 */

#include <SPI.h>
#include <Ethernet.h>
#include <ArduinoJson.h>
#include "Adafruit_Thermal.h"

#include "SoftwareSerial.h"
#define TX_PIN 6 // Arduino transmit  YELLOW WIRE  labeled RX on printer
#define RX_PIN 5 // Arduino receive   GREEN WIRE   labeled TX on printer

unsigned long currentMillis;
unsigned long checkMillis;
unsigned long thresholdMillis = 60000UL;

SoftwareSerial mySerial(RX_PIN, TX_PIN); // Declare SoftwareSerial obj first
Adafruit_Thermal printer(&mySerial);     // Pass addr to printer constructor

// Enter a MAC address for your controller below.
// Newer Ethernet shields have a MAC address printed on a sticker on the shield
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

// if you don't want to use DNS (and reduce your sketch size)
// use the numeric IP instead of the name for the server:
//IPAddress server(74,125,232,128);  // numeric IP for Google (no DNS)
char server[] = "192.168.1.220";    // name address for Google (using DNS)

// Set the static IP address to use if the DHCP fails to assign
IPAddress ip(192, 168, 0, 177);
IPAddress myDns(192, 168, 0, 1);

// Initialize the Ethernet client library
// with the IP address and port of the server
// that you want to connect to (port 80 is default for HTTP):
EthernetClient client;

// Variables to measure the speed
unsigned long beginMicros, endMicros;
unsigned long byteCount = 0;
bool printWebData = true;  // set to false for better speed measurement

void setup() {
  mySerial.begin(19200);  // Initialize SoftwareSerial
  //Ethernet.init(33);  // ESP32 with Adafruit Featherwing Ethernet
  printer.begin();
  printer.setDefault();

  // Open serial communications and wait for port to open:
  Serial.begin(9600);
  while (!Serial) {
    ; // wait for serial port to connect. Needed for native USB port only
  }

  // start the Ethernet connection:
  Serial.println("Initialize Ethernet with DHCP:");
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Failed to configure Ethernet using DHCP");
    // Check for Ethernet hardware present
    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
      printer.println("Ethernet shield was not found.  Sorry, can't run without hardware. :(");
      while (true) {
        delay(1); // do nothing, no point running without Ethernet hardware
      }
    }
    if (Ethernet.linkStatus() == LinkOFF) {
      printer.println("Ethernet cable is not connected.");
    }
    // try to congifure using IP address instead of DHCP:
    Ethernet.begin(mac, ip, myDns);
  } else {
    printer.println("DHCP assigned IP:");
    printer.println(Ethernet.localIP());
    printer.feed(2);
  }
  // give the Ethernet shield a second to initialize:
  delay(1000);
  Serial.print("connecting to ");
  Serial.print(server);
  Serial.println("...");

  checkForMessages();
  
}

void loop() {
  //save the current time
  currentMillis = millis();
  if (currentMillis - checkMillis >= thresholdMillis){
    checkMillis = checkMillis + thresholdMillis;
    //printer.println(F("1 Minute has passed"));
    checkForMessages();
  }
}

void checkForMessages()
{
    // if you get a connection, report back via serial:
  if (client.connect(server, 1880)) {
      Serial.print("connected to ");
      Serial.println(client.remoteIP());


      // Send HTTP request
      client.println(F("GET /tabbytreeorders HTTP/1.0"));
      client.println(F("Host: 192.168.1.220:1880"));
      client.println(F("Connection: close"));
      if (client.println() == 0) {
        printer.println(F("Failed to send request"));

        thresholdMillis = 60000UL *10; //Change to every 10 minutes if we have an error
        return;
      }
    
      // Check HTTP status
      char status[32] = {0};
      client.readBytesUntil('\r', status, sizeof(status));
      // It should be "HTTP/1.0 200 OK" or "HTTP/1.1 200 OK"
      if (strcmp(status + 9, "200 OK") != 0) {
        printer.println(F("Unexpected response: "));
        printer.println(status);
        thresholdMillis = 60000UL *10; //Change to every 10 minutes if we have an error
        return;
      }
    
      // Skip HTTP headers
      char endOfHeaders[] = "\r\n\r\n";
      if (!client.find(endOfHeaders)) {
        printer.println(F("Invalid response"));
        thresholdMillis = 60000UL *10; //Change to every 10 minutes if we have an error
        return;
      }
    
      // Allocate the JSON document
      // Use arduinojson.org/v6/assistant to compute the capacity.
      const size_t capacity = JSON_ARRAY_SIZE(2) + JSON_OBJECT_SIZE(1) + 343;
      DynamicJsonDocument doc(capacity);
    
      // Parse JSON object
      DeserializationError error = deserializeJson(doc, client);
      if (error) {
        printer.println(F("deserializeJson() failed: "));
        Serial.println(error.c_str());
        thresholdMillis = 60000UL *10; //Change to every 10 minutes if we have an error
        return;
      }
    
      // Extract values
    
        JsonArray arr = doc["messages"].as<JsonArray>();
        for (char* repo : arr) {
          Serial.print(repo);
          printer.println(repo);
          printer.feed(1);

          //Reset our wait time to 1 minute
          thresholdMillis = 60000UL;
      
        }
    
      // Disconnect
      //client.stop();
      printer.sleep();      // Tell printer to sleep
      delay(3000L);         // Sleep for 3 seconds
      printer.wake();       // MUST wake() before printing again, even if reset
      printer.setDefault(); // Restore printer to defaults
    } else {
      // if you didn't get a connection to the server:
      Serial.println("connection failed");
    }
}
