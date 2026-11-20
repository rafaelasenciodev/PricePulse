# language: en
# Feature 05 - Notifications and Price History. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "Not found" means the answer given for something that does not exist. "Rejected" means that
# the request is not valid, and that nothing is answered from it.

Feature: Notifications and Price History
  A User reads the Notifications of their own Price Alerts, and the Price History of any Listing.
  Reading changes nothing.

  # ---------------------------------------------------------------------------
  # Notifications
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02 @BR-03
  Scenario: A User reads their Notifications, newest first
    Given a signed-in User has a Notification whose price was observed at 10:00
    And a Notification whose price was observed at 12:00
    When the User reads their Notifications
    Then the Notification observed at 12:00 comes first
    And each one shows its Price Alert, the Listing, the Target Price, and the Current Price with its Observed At

  @SC-02 @BR-02
  Scenario: Notifications whose prices were observed at the same moment come in a stable order
    Given a signed-in User has two Notifications whose prices were observed at 10:00
    When the User reads their Notifications
    Then they come ordered by the identifier of their Price Alert

  @SC-03 @BR-01
  Scenario: A User sees only their own Notifications
    Given a signed-in User has one Notification
    And another User has two Notifications
    When the User reads their Notifications
    Then only their own Notification is listed

  @SC-04 @BR-02
  Scenario: A User without Notifications gets an empty list
    Given a signed-in User has no Notifications
    When the User reads their Notifications
    Then the list is empty

  @SC-05 @BR-01 @BR-03
  Scenario: The Notification of a Price Alert that was cancelled afterwards is still listed
    Given a signed-in User has a Notification whose Price Alert was Cancelled after it was produced
    When the User reads their Notifications
    Then the Notification is listed

  @SC-06 @BR-02 @BR-08
  Scenario: The Notifications are read in pages
    Given a signed-in User has five Notifications
    When the User reads their Notifications asking for two at a time, starting at the third
    Then the third and the fourth in order are listed
    And the total is five

  # ---------------------------------------------------------------------------
  # Who is asking
  # ---------------------------------------------------------------------------

  @SC-07 @BR-01 @BR-04
  Scenario Outline: A caller who is not signed in cannot read
    Given a caller who is not signed in
    When the caller tries to read <what>
    Then the request is rejected because the caller must be signed in
    And nothing is answered

    Examples:
      | what                              |
      | the Notifications                 |
      | the Price History of a Listing    |

  @SC-08 @BR-01 @BR-04
  Scenario Outline: The credential of a Provider is not valid for reading
    Given a Provider with its credential
    When the Provider tries to read <what>
    Then the request is rejected because only a User who has signed in can read
    And nothing is answered

    Examples:
      | what                              |
      | the Notifications                 |
      | the Price History of a Listing    |

  @SC-09 @BR-09
  Scenario Outline: Reading changes nothing
    Given a signed-in User with a Triggered Price Alert and its Notification
    And the Listing has Price Observations
    When the User reads <what>
    Then no Notification is produced and no Evaluation is started
    And the Price Alerts, the Notifications and the Price Observations are unchanged

    Examples:
      | what                              |
      | the Notifications                 |
      | the Price History of the Listing  |

  # ---------------------------------------------------------------------------
  # Price History
  # ---------------------------------------------------------------------------

  @SC-10 @BR-05
  Scenario: The Price History of a Listing, newest Observed At first
    Given a signed-in User
    And the Listing "Headphones at Shop A" has Price Observations of the Provider "simulator" with a Price of 100.00 EUR at 10:00, 90.00 EUR at 11:00 and 95.00 EUR at 12:00
    When the User reads the Price History of that Listing
    Then the Price Observations come in this order: 12:00, 11:00, 10:00
    And each one shows its Provider, its Observed At and its Price

  @SC-11 @BR-05
  Scenario: A moment when the Listing was unavailable is in the history
    Given a signed-in User
    And the Listing "Headphones at Shop A" has a Price Observation with a Price of 100.00 EUR at 10:00
    And a Price Observation without a Price at 11:00
    When the User reads the Price History of that Listing
    Then the observation at 11:00 shows that the Listing was unavailable
    And the observation at 10:00 shows its Price

  @SC-12 @BR-05
  Scenario: An observation that arrived late is in its place by Observed At
    Given a signed-in User
    And the Listing "Headphones at Shop A" had a Price Observation at 11:00 recorded first
    And a Price Observation at 10:00 recorded afterwards
    When the User reads the Price History of that Listing
    Then the Price Observations come in this order: 11:00, 10:00

  @SC-13 @BR-05
  Scenario: Only the Price Observations of the Listing asked for are in its history
    Given a signed-in User
    And the Listing "Headphones at Shop A" has one Price Observation
    And the Listing "Keyboard at Shop B" has two
    When the User reads the Price History of "Headphones at Shop A"
    Then only its one Price Observation is listed

  @SC-14 @BR-05
  Scenario: A Listing without Price Observations has an empty history
    Given a signed-in User
    And the Listing "Headphones at Shop A" exists and has no Price Observations
    When the User reads the Price History of that Listing
    Then the history is empty
    And no error is reported

  @SC-15 @BR-07
  Scenario: The Price History of a Listing that does not exist is not found
    Given a signed-in User
    And there is no such Listing
    When the User reads its Price History
    Then it is answered as not found

  # ---------------------------------------------------------------------------
  # A range of the history
  # ---------------------------------------------------------------------------

  @SC-16 @BR-06
  Scenario: A range includes its start and leaves out its end
    Given a signed-in User
    And the Listing "Headphones at Shop A" has Price Observations at 10:00, 11:00 and 12:00
    When the User reads its Price History from 10:00 to 12:00
    Then the Price Observations at 11:00 and 10:00 are listed
    And the one at 12:00 is not

  @SC-17 @BR-06
  Scenario Outline: A range can have only a start, or only an end
    Given a signed-in User
    And the Listing "Headphones at Shop A" has Price Observations at 10:00, 11:00 and 12:00
    When the User reads its Price History <range>
    Then the Price Observations at <listed> are listed

    Examples:
      | range           | listed        |
      | from 11:00      | 12:00 and 11:00 |
      | to 11:00        | 10:00           |

  @SC-18 @BR-06
  Scenario Outline: A range that is not valid is rejected
    Given a signed-in User
    And the Listing "Headphones at Shop A" has Price Observations
    When the User reads its Price History with <range>
    Then the request is rejected because <reason>
    And nothing is answered

    Examples:
      | range                      | reason                              |
      | a start of "yesterday"     | the start is not an instant         |
      | an end of "tomorrow"       | the end is not an instant           |
      | a start after the end      | the start must be before the end    |
      | a start equal to the end   | the start must be before the end    |

  # ---------------------------------------------------------------------------
  # Pages
  # ---------------------------------------------------------------------------

  @SC-19 @BR-05 @BR-08
  Scenario: The Price History is read in pages, and the total counts the range
    Given a signed-in User
    And the Listing "Headphones at Shop A" has five Price Observations at 08:00, 09:00, 10:00, 11:00 and 12:00
    When the User reads its Price History from 09:00 asking for two at a time
    Then the first page has the observations at 12:00 and 11:00
    And the total is four

  @SC-20 @BR-08
  Scenario Outline: A limit or an offset out of range is rejected
    Given a signed-in User
    When the User reads either the Notifications or a Price History with <value>
    Then the request is rejected because <reason>
    And nothing is answered

    Examples:
      | value              | reason                                   |
      | a limit of 0       | the limit must be at least 1             |
      | a limit of 101     | the limit must be at most 100            |
      | a limit of "many"  | the limit must be a whole number         |
      | an offset of -1    | the offset must be at least 0            |
