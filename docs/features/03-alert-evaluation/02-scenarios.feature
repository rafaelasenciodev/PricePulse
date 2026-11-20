# language: en
# Feature 03 - Alert Evaluation. Phase 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-business-rules.md
#
# How an Evaluation is started is a design matter and does not appear here: the scenarios
# say "the Listing is evaluated" and describe what follows.

Feature: Alert Evaluation
  When the Current Price of a Listing reaches the Target Price of an Active Price Alert,
  the Price Alert becomes Triggered and a Notification is produced for its User, once.

  # ---------------------------------------------------------------------------
  # Happy paths
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02 @BR-04 @BR-05
  Scenario: A Price Alert whose Target Price is reached becomes Triggered and produces a Notification
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 79.90 EUR, observed at 10:00
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And a Notification is produced for the User
    And the Notification states the Price Alert, the Listing, the Target Price of 80.00 EUR and the Current Price of 79.90 EUR observed at 10:00

  @SC-02 @BR-02
  Scenario: A Current Price equal to the Target Price reaches it
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 80.00 EUR
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And a Notification is produced for the User

  @SC-03 @BR-02
  Scenario: A Current Price above the Target Price does not reach it
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 80.01 EUR
    When the Listing is evaluated
    Then the Price Alert is still Active
    And no Notification is produced

  @SC-04 @BR-02
  Scenario: A Current Price of zero reaches any Target Price
    Given a User has an Active Price Alert for the Listing "Online course at Shop A" with a Target Price of 10.00 EUR
    And the Current Price of the Listing is 0.00 EUR
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And a Notification is produced for the User

  # ---------------------------------------------------------------------------
  # Without a Current Price
  # ---------------------------------------------------------------------------

  @SC-05 @BR-03
  Scenario: A Listing whose latest Price Observation has no Price triggers nothing
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Listing has no Current Price because it is unavailable
    When the Listing is evaluated
    Then the Price Alert is still Active
    And no Notification is produced

  @SC-06 @BR-03
  Scenario: A Listing with no Price Observation triggers nothing
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Listing has no Price Observation
    When the Listing is evaluated
    Then the Price Alert is still Active
    And no Notification is produced

  @SC-07 @BR-03
  Scenario: A Listing that has a Price again is evaluated against that Price
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Listing was unavailable and now has a Current Price of 75.00 EUR
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And a Notification is produced for the User

  # ---------------------------------------------------------------------------
  # Several Price Alerts
  # ---------------------------------------------------------------------------

  @SC-08 @BR-01 @BR-02
  Scenario: Only the Price Alerts whose Target Price is reached are Triggered
    Given the Listing "Headphones at Shop A" has an Active Price Alert with a Target Price of 70.00 EUR
    And it has an Active Price Alert with a Target Price of 80.00 EUR
    And it has an Active Price Alert with a Target Price of 90.00 EUR
    And the Current Price of the Listing is 85.00 EUR
    When the Listing is evaluated
    Then the Price Alert with a Target Price of 90.00 EUR is Triggered
    And the other two Price Alerts are still Active
    And one Notification is produced

  @SC-09 @BR-04 @BR-05
  Scenario: Each Price Alert that is reached has its own Notification
    Given two Users have each an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated
    Then both Price Alerts are Triggered
    And each User has one Notification

  @SC-10 @BR-01
  Scenario: The Price Alerts of another Listing are not evaluated
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And a User has an Active Price Alert for the Listing "Keyboard at Shop B" with a Target Price of 80.00 USD
    And the Current Price of both Listings is below their Target Price
    When the Listing "Headphones at Shop A" is evaluated
    Then the Price Alert of "Headphones at Shop A" is Triggered
    And the Price Alert of "Keyboard at Shop B" is still Active
    And one Notification is produced

  # ---------------------------------------------------------------------------
  # Triggered once, and repeating
  # ---------------------------------------------------------------------------

  @SC-11 @BR-01
  Scenario: A Triggered Price Alert is not evaluated again
    Given a Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR is Triggered and has its Notification
    And the Current Price of the Listing falls to 60.00 EUR
    When the Listing is evaluated
    Then the Price Alert is still Triggered
    And no other Notification is produced

  @SC-12 @BR-07
  Scenario: Repeating an Evaluation when nothing has changed changes nothing
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    And the Listing has been evaluated
    When the Listing is evaluated again
    Then the Price Alert is still Triggered
    And the User has one Notification

  @SC-13 @BR-05 @BR-07
  Scenario: Two Evaluations at the same time produce a single Notification
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated twice at the same time
    Then the Price Alert is Triggered
    And the User has one Notification

  # ---------------------------------------------------------------------------
  # Failures between the two changes
  # ---------------------------------------------------------------------------

  @SC-14 @BR-06
  Scenario: If the Notification cannot be produced, the Price Alert stays Active and a later Evaluation completes it
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    And a Notification cannot be produced
    When the Listing is evaluated
    Then the Price Alert is still Active
    And no Notification exists
    When the Notification can be produced and the Listing is evaluated again
    Then the Price Alert is Triggered
    And the User has one Notification

  @SC-15 @BR-05 @BR-06
  Scenario: A Notification exists and the Price Alert is still Active: the next Evaluation makes it Triggered
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And a Notification was produced for it but the Price Alert did not become Triggered
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And the User has one Notification

  @SC-16 @BR-06
  Scenario: The existing Notification decides, even if the Current Price has risen since
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And a Notification was produced for it but the Price Alert did not become Triggered
    And the Current Price of the Listing is now 95.00 EUR
    When the Listing is evaluated
    Then the Price Alert is Triggered
    And the User has one Notification

  # ---------------------------------------------------------------------------
  # Boundaries
  # ---------------------------------------------------------------------------

  @SC-17 @BR-08
  Scenario: Producing a Notification does not deliver it
    Given a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated
    Then a Notification is produced for the User
    And the Notification has no channel
    And nothing is delivered to the User

  @SC-18 @BR-09
  Scenario: The Evaluation changes nothing but the state of the Price Alerts it Triggers
    Given the Listing "Headphones at Shop A" has an Active Price Alert with a Target Price of 80.00 EUR
    And it has an Active Price Alert with a Target Price of 70.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated
    Then the Price Alert with a Target Price of 80.00 EUR is Triggered
    And the Price Alert with a Target Price of 70.00 EUR is unchanged
    And no Price Alert is created, cancelled or modified
    And the Price Observations of the Listing are unchanged

  @SC-19 @BR-10
  Scenario: A Listing that does not exist has nothing to evaluate
    Given there is no such Listing
    When the Listing is evaluated
    Then there is nothing to evaluate
    And no error is reported
    And no Notification is produced
