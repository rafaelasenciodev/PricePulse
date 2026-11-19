# language: en
# Feature 04 - Read and Manage Price Alerts. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "Not found" means the answer given for something that does not exist. For an alert of another
# User it is the same answer (BR-01). "Conflict" means that the request cannot be applied to the
# state the alert is in.

Feature: Read and Manage Price Alerts
  A User sees their Price Alerts, corrects the Target Price of one that is still Active,
  or cancels it. Nobody else can see or change them.

  # ---------------------------------------------------------------------------
  # Reading
  # ---------------------------------------------------------------------------

  @SC-01 @BR-02 @BR-09
  Scenario: A User reads their Price Alerts, newest first
    Given a signed-in User has a Price Alert for "Headphones at Shop A" created at 10:00
    And a Price Alert for "Keyboard at Shop B" created at 12:00
    When the User reads their Price Alerts
    Then the Price Alert for "Keyboard at Shop B" comes first
    And each one shows its Listing, its Target Price with its currency, its state and its creation moment

  @SC-02 @BR-02
  Scenario: The Price Alerts can be filtered by state
    Given a signed-in User has an Active, a Triggered and a Cancelled Price Alert
    When the User reads their Price Alerts that are Active
    Then only the Active Price Alert is listed

  @SC-03 @BR-01 @BR-02
  Scenario: A User sees only their own Price Alerts
    Given a signed-in User has one Price Alert
    And another User has two Price Alerts
    When the User reads their Price Alerts
    Then only their own Price Alert is listed

  @SC-04 @BR-02
  Scenario: A User without Price Alerts gets an empty list
    Given a signed-in User has no Price Alerts
    When the User reads their Price Alerts
    Then the list is empty

  @SC-05 @BR-02
  Scenario: A User reads one of their Price Alerts
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    When the User reads that Price Alert
    Then it shows its Listing, its Target Price of 80.00 EUR, its state and its creation moment

  # ---------------------------------------------------------------------------
  # Whose alert it is, and who is asking
  # ---------------------------------------------------------------------------

  @SC-06 @BR-01
  Scenario Outline: An alert of another User, or one that does not exist, is answered as not found
    Given a signed-in User
    And <case>
    When the User tries to <action> that Price Alert
    Then it is answered as not found
    And nothing is changed

    Examples:
      | case                                      | action |
      | another User has an Active Price Alert    | read   |
      | another User has an Active Price Alert    | modify |
      | another User has an Active Price Alert    | cancel |
      | there is no such Price Alert              | read   |
      | there is no such Price Alert              | modify |
      | there is no such Price Alert              | cancel |

  @SC-07 @BR-01
  Scenario: A caller who is not signed in cannot read, modify or cancel Price Alerts
    Given a caller who is not signed in
    When the caller tries to read, modify or cancel a Price Alert
    Then the request is rejected because the caller must be signed in
    And nothing is changed

  # ---------------------------------------------------------------------------
  # Cancelling
  # ---------------------------------------------------------------------------

  @SC-08 @BR-03
  Scenario: Cancelling an Active Price Alert makes it Cancelled
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A"
    When the User cancels that Price Alert
    Then the Price Alert is Cancelled
    And it is still in the list of the User

  @SC-09 @BR-03
  Scenario: A Cancelled Price Alert is not evaluated again
    Given a signed-in User has a Cancelled Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 75.00 EUR
    When the Listing is evaluated
    Then the Price Alert is still Cancelled
    And no Notification is produced

  @SC-10 @BR-03
  Scenario: After cancelling, the User can create another Active Price Alert for the same Listing
    Given a signed-in User has a Cancelled Price Alert for "Headphones at Shop A"
    When the User creates a Price Alert for "Headphones at Shop A" with a Target Price of 70.00 EUR
    Then the new Price Alert is Active
    And the Cancelled one is unchanged

  @SC-11 @BR-04
  Scenario: Cancelling a Cancelled Price Alert changes nothing
    Given a signed-in User has a Cancelled Price Alert
    When the User cancels that Price Alert
    Then the request succeeds
    And the Price Alert is still Cancelled

  @SC-12 @BR-04
  Scenario: A Triggered Price Alert cannot be cancelled
    Given a signed-in User has a Triggered Price Alert
    When the User cancels that Price Alert
    Then the request is rejected as a Conflict because the Price Alert has already ended
    And the Price Alert is still Triggered

  @SC-13 @BR-07
  Scenario Outline: Cancelling or modifying does not produce a Notification or start an Evaluation
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 85.00 EUR
    When the User <action> that Price Alert
    Then no Notification is produced
    And no Evaluation is started

    Examples:
      | action                           |
      | cancels                          |
      | modifies the Target Price of     |

  # ---------------------------------------------------------------------------
  # Modifying the Target Price
  # ---------------------------------------------------------------------------

  @SC-14 @BR-05 @BR-06 @BR-09
  Scenario: Modifying the Target Price of an Active Price Alert
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR created at 10:00
    And the Current Price of the Listing is 100.00 EUR
    When the User modifies its Target Price to 70.00
    Then the Price Alert has a Target Price of 70.00 EUR
    And it is still Active
    And its owner, its Listing and its creation moment of 10:00 are unchanged

  @SC-15 @BR-05
  Scenario Outline: A Target Price that is not valid is rejected
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Listing is priced in EUR
    When the User modifies its Target Price to <amount>
    Then the request is rejected because <reason>
    And the Target Price is still 80.00 EUR

    Examples:
      | amount | reason                                            |
      | 0.00   | the Target Price must be greater than zero        |
      | -5.00  | the Target Price must be greater than zero        |
      | 79.999 | the Target Price has more decimals than EUR allows |

  @SC-16 @BR-05
  Scenario: A Target Price that the Current Price already reaches is rejected
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Current Price of the Listing is 85.00 EUR
    When the User modifies its Target Price to 90.00
    Then the request is rejected because the Target Price is already reached by the Current Price
    And the Target Price is still 80.00 EUR

  @SC-17 @BR-05
  Scenario Outline: Only an Active Price Alert can be modified
    Given a signed-in User has a <state> Price Alert with a Target Price of 80.00 EUR
    When the User modifies its Target Price to 70.00
    Then the request is rejected as a Conflict because the Price Alert is not Active
    And the Target Price is still 80.00 EUR

    Examples:
      | state     |
      | Triggered |
      | Cancelled |

  @SC-18 @BR-06
  Scenario: Modifying to the Target Price it already has changes nothing
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    When the User modifies its Target Price to 80.00
    Then the request succeeds
    And the Price Alert is unchanged

  @SC-19 @BR-05
  Scenario: A Listing without a Current Price allows any valid Target Price
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the Listing has no Current Price
    When the User modifies its Target Price to 90.00
    Then the Price Alert has a Target Price of 90.00 EUR

  # ---------------------------------------------------------------------------
  # When the alert changes while the User acts on it
  # ---------------------------------------------------------------------------

  @SC-20 @BR-08
  Scenario Outline: If an Evaluation Triggers the alert first, the request is rejected as a Conflict
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And the User's request to <action> it has read the alert
    And an Evaluation then makes the Price Alert Triggered
    When the request is applied
    Then it is rejected as a Conflict
    And the Price Alert is still Triggered with its Target Price of 80.00 EUR

    Examples:
      | action                       |
      | cancel                       |
      | modify the Target Price of   |

  @SC-21 @BR-08
  Scenario: A Notification produced just before a cancellation stays stored
    Given a signed-in User has an Active Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    And an Evaluation has produced its Notification but has not yet made the alert Triggered
    When the User cancels the Price Alert
    Then the Price Alert is Cancelled
    And the Notification stays stored
    And the Evaluation reports that it could not finish the alert

  # ---------------------------------------------------------------------------
  # Creation moment
  # ---------------------------------------------------------------------------

  @SC-22 @BR-09
  Scenario: A new Price Alert records when it was created
    Given a signed-in User and the moment 10:00
    When the User creates a Price Alert for "Headphones at Shop A" with a Target Price of 80.00 EUR
    Then the Price Alert has a creation moment of 10:00
