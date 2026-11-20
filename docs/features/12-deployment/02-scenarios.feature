# language: en
# Feature 12 - Deployment. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable behaviour in the project's ubiquitous language. Each scenario has an identifier
# (@SC-nn) and the business rules it exercises (@BR-nn). Rules: 01-discovery.md, section 6.
#
# "The server is started" means that its process starts with the environment that the scenario states. "Demo mode"
# is the declaration of the discovery, Q5; the names of the variables are left to the design. "The public demo" is a
# server in demo mode, in production, reached by an https address. "A Reviewer" is a person who tries it, and the
# interactive documentation of the API is the page where a Reviewer can send requests with a token.
# The Listing "headphones-shop-a" is the one of the demo data, with a Current Price of "100.00" EUR.
#
# Not covered here, because the discovery leaves it to the design: how the interface learns that the server is a
# demo, and whether the interface shows the notice outside demo mode.

Feature: Deployment
  The application can be reached at a public address as a demo with simulated data. A Reviewer can try the whole
  round trip in a browser, and the server is honest about what it is.

  # ---------------------------------------------------------------------------
  # Whether the server may run in production
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01
  Scenario: The server refuses production without the demo mode
    When the server is started in production without declaring the demo mode
    Then the server does not start
    And it says that its demo Accounts have public passwords, so it must not run in production

  @SC-02 @BR-01
  Scenario: The server runs in production when it is declared a demo
    When the server is started in production and declared a demo
    Then the server starts
    And the demo data exists

  @SC-03 @BR-01
  Scenario: Outside production nothing needs to be declared
    When the server is started for development, without declaring the demo mode
    Then the server starts as it always did

  @SC-19 @BR-10
  Scenario: In production the server does not start without a database
    When the server is started in production and declared a demo, with no database address
    Then the server does not start
    And it says that a database is needed to run in production

  @SC-20 @BR-11
  Scenario: In production the server does not start without the origin of the application
    When the server is started in production and declared a demo, without the origin of the application
    Then the server does not start
    And it says that the origin of the application is needed to run in production

  # ---------------------------------------------------------------------------
  # The demo says what it is
  # ---------------------------------------------------------------------------

  @SC-04 @BR-02
  Scenario: The server says that it is a demo when it starts
    When the server is started as a demo
    Then it says that it is a demo with simulated data

  @SC-05 @BR-02
  Scenario: The interactive documentation says that it is a demo
    Given the public demo
    When a Reviewer opens the interactive documentation of the API
    Then it says that the data is simulated
    And it gives the demo Accounts and the token of the Provider "simulator", which are public

  @SC-06 @BR-03
  Scenario Outline: The interface shows a notice that the data is simulated
    Given the public demo
    When a Reviewer opens the screen <screen> of the interface
    Then a visible notice says that it is a demo with simulated data

    Examples:
      | screen                  |
      | to sign in              |
      | with the Catalogue      |
      | with their Price Alerts |

  # ---------------------------------------------------------------------------
  # Address and cookie
  # ---------------------------------------------------------------------------

  @SC-07 @BR-04
  Scenario: Without an address the server answers only on the local machine
    When the server is started without saying an address
    Then it answers requests from the same machine
    And it does not answer requests that arrive from another machine

  @SC-08 @BR-04
  Scenario: The server answers on the address that it is told
    When the server is started told to listen on all the addresses of the machine
    Then it answers requests that arrive from another machine

  @SC-09 @BR-05
  Scenario Outline: The cookie of the Session is Secure only for an https origin
    Given the server is started with the origin of the application "<origin>"
    When a person signs in from the browser
    Then the cookie of the Session is <state>

    Examples:
      | origin                | state      |
      | https://demo.example  | Secure     |
      | http://127.0.0.1:3000 | not Secure |

  @SC-10 @BR-05
  Scenario: A change of data is refused when the origin is not the one of the application
    Given the public demo with the origin of the application "https://demo.example"
    When a request that changes data, authenticated by the cookie, arrives from the origin "https://other.example"
    Then it is refused as a forbidden origin
    And nothing is changed

  # ---------------------------------------------------------------------------
  # The round trip of a Reviewer
  # ---------------------------------------------------------------------------

  @SC-11 @BR-06
  Scenario: A Reviewer registers their own Account and sees only their own data
    Given the public demo
    And "demo1@example.com" has a Price Alert
    When a Reviewer registers with "rev@example.com" and signs in
    Then the Reviewer has no Price Alerts
    And the Reviewer cannot read the alert of "demo1@example.com"

  @SC-12 @BR-06
  Scenario: Registration is not limited
    Given the public demo
    When 20 different emails are registered one after another
    Then all 20 Accounts are created

  @SC-13 @BR-07
  Scenario: A Reviewer makes a price fall and sees the alert reach its target
    Given the public demo
    And a Reviewer registered and signed in
    And the Reviewer has an Active Price Alert for "headphones-shop-a" with a Target Price of "80.00"
    When a Reviewer records, with the token of the Provider "simulator", a price of "79.00" EUR for "headphones-shop-a"
    Then the alert of the Reviewer is Triggered
    And the Reviewer reads a Notification with the Target Price "80.00" and the Current Price "79.00"
    And the Price History of the Listing says that the price was reported by "simulator"

  @SC-14 @BR-07
  Scenario: A User cannot record a price
    Given the public demo
    And a Reviewer registered and signed in
    When the Reviewer tries to record a price with their own token
    Then the request is refused as not authenticated
    And the Current Price of the Listing is the same

  # ---------------------------------------------------------------------------
  # The Author resets the demo
  # ---------------------------------------------------------------------------

  @SC-15 @BR-08
  Scenario: The reset returns the data to the first state of the demo
    Given the public demo
    And a Reviewer registered, created an alert and recorded a price of "79.00" EUR for "headphones-shop-a"
    When the Author runs the reset of the demo
    Then the Account of the Reviewer does not exist
    And the Current Price of "headphones-shop-a" is "100.00"
    And "demo1@example.com" has only its demo Price Alert, with a Target Price of "80.00"
    And "demo1@example.com" can sign in with its demo password

  @SC-16 @BR-08
  Scenario: A Session that existed before the reset does not identify anyone after it
    Given the public demo
    And a Reviewer registered and signed in
    When the Author runs the reset of the demo
    Then the token that the Reviewer had does not identify anyone

  @SC-17 @BR-08
  Scenario: The reset that cannot reach the database changes nothing and says why
    Given the public demo with a database that cannot be reached
    When the Author runs the reset of the demo
    Then it ends with an error that says only the code of the failure
    And no data was changed

  # ---------------------------------------------------------------------------
  # What the demo does not do
  # ---------------------------------------------------------------------------

  @SC-18 @BR-09
  Scenario: The limit on sign-in still protects an Account of the demo
    Given the public demo
    When 5 sign-ins in a row fail for "demo1@example.com"
    Then further sign-ins for that email are refused for 15 minutes, whatever the password
