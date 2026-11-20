# language: en
# Feature 10 - My Alerts and My Notifications. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable behaviour of the interface in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "The person" is whoever uses the interface in a browser, and "the application" is the backend that the
# interface talks to. A "message" is a text of the interface in Spanish: the scenarios say what it tells and
# the design fixes its words. "Signed in" means that the browser holds the cookie of a Session that is valid.
# The interface is reached at "/app/". The screens of this feature are "my alerts" at "/app/alerts" and
# "my notifications" at "/app/notifications". The rules of access, of the Catalogue and of creating an alert
# are those of feature 09 and are not repeated.

Feature: My Alerts and My Notifications
  A person sees the Price Alerts that they have, changes the Target Price of an Active one or cancels it, and
  reads the Notifications of the alerts that reached their price.

  Background:
    Given the application serves the interface
    And the person is signed in
    And the Catalogue has six Listings

  # ---------------------------------------------------------------------------
  # Who sees what
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01
  Scenario Outline: A person who is not signed in is taken to sign in
    Given the person is not signed in
    When the person opens the address "<address>"
    Then the sign-in screen is shown

    Examples:
      | address            |
      | /app/alerts        |
      | /app/notifications |

  @SC-02 @BR-01
  Scenario: The navigation leads to the three screens of a person who is signed in
    When the person looks at any screen of a person who is signed in
    Then it has a link to the Catalogue, a link to "my alerts" and a link to "my notifications"

  # ---------------------------------------------------------------------------
  # Reading my alerts
  # ---------------------------------------------------------------------------

  @SC-03 @BR-02 @BR-03
  Scenario: Each alert shows what is needed to recognise it
    Given the person has an Active Price Alert for "headphones-shop-a" with a Target Price of "80.00" EUR
    When the person opens "my alerts"
    Then the alert shows the title and the Retailer of that Listing
    And it shows the Target Price "80.00" with its currency, its state and the moment it was created
    And the title leads to the screen of that Listing

  @SC-04 @BR-02
  Scenario: The alerts are listed newest first, as the application gives them
    Given the person has three Price Alerts created at different moments
    When the person opens "my alerts"
    Then the alerts appear from the newest to the oldest

  @SC-05 @BR-02
  Scenario: A person with no alerts is told so, and is offered the Catalogue
    Given the person has no Price Alerts
    When the person opens "my alerts"
    Then a message says that there are no alerts
    And the screen has a link to the Catalogue

  @SC-06 @BR-02
  Scenario Outline: The alerts can be filtered by state, and the filter is in the address
    Given the person has one Active, one Triggered and one Cancelled Price Alert
    When the person chooses to see <filter>
    Then only <shown> are listed
    And the address has the filter, so reloading the page shows the same list

    Examples:
      | filter           | shown                  |
      | all              | the three alerts       |
      | the Active ones  | the Active alert       |
      | the Triggered    | the Triggered alert    |
      | the Cancelled    | the Cancelled alert    |

  @SC-07 @BR-02
  Scenario: A long list is read one page at a time, and the page is in the address
    Given the person has 25 Price Alerts
    When the person opens "my alerts"
    Then the first 20 are listed, with a way to go to the next page
    When the person goes to the next page
    Then the remaining 5 are listed, with a way to go back
    And the address has the page

  @SC-08 @BR-03
  Scenario: The titles come from the Catalogue, also for a Listing that is not in its first 100
    Given the person has an alert for a Listing that is not among the first 100 of the Catalogue
    When the person opens "my alerts"
    Then the alert shows the title and the Retailer of that Listing

  @SC-09 @BR-03
  Scenario Outline: When a title cannot be found, the identifier is shown and nothing else fails
    Given the person has an alert, and a Notification, for the Listing "headphones-shop-a"
    And <cause>
    When the person opens <screen>
    Then the entry shows "headphones-shop-a" in place of the title
    And the rest of the entry is complete

    Examples:
      | cause                                                | screen                 |
      | the application cannot find that Listing             | "my alerts"            |
      | the read of the Catalogue fails                      | "my alerts"            |
      | the application cannot find that Listing             | "my notifications"     |

  @SC-10 @BR-02
  Scenario: A Price Alert that was just created is in the list
    Given the person creates a Price Alert from the screen of a Listing
    When the person opens "my alerts"
    Then the new alert is listed

  # ---------------------------------------------------------------------------
  # Changing the Target Price
  # ---------------------------------------------------------------------------

  @SC-11 @BR-04
  Scenario Outline: Only an Active alert offers to change its Target Price and to cancel
    Given the person has a <state> Price Alert
    When the person opens "my alerts"
    Then the alert <offer>

    Examples:
      | state     | offer                                                  |
      | Active    | offers to change its Target Price and to cancel it     |
      | Triggered | offers neither                                         |
      | Cancelled | offers neither                                         |

  @SC-12 @BR-05 @BR-08
  Scenario: Changing the Target Price sends what was written, and the list is read again
    Given the person has an Active alert with a Target Price of "80.00"
    When the person chooses to change it and writes " 70.00 "
    And the person sends the form
    Then the request carries the text "70.00", and not a number
    And the list is read again from the application
    And the alert shows the Target Price "70.00"

  @SC-13 @BR-05
  Scenario: Changing the Target Price with an empty field is not sent
    Given the person has chosen to change the Target Price of an Active alert
    When the person sends the form with the field empty
    Then no request is made to the application
    And a message says that the amount is needed

  @SC-14 @BR-05
  Scenario: The person can give up changing the Target Price
    Given the person has chosen to change the Target Price of an Active alert
    When the person gives up
    Then no request is made to the application
    And the alert shows its Target Price as before

  @SC-15 @BR-07
  Scenario Outline: Each answer of changing a Target Price has its own message
    Given the person has chosen to change the Target Price of an Active alert
    When the person sends an amount and the application answers <answer>
    Then a message says <message>
    And the person can correct the amount and send it again, where it makes sense

    Examples:
      | answer                                      | message                                                  |
      | that the amount is not valid                | that the amount is not valid                             |
      | that the Current Price already reaches it   | that the Current Price already reaches that target       |
      | that the alert is no longer Active          | that the alert is no longer Active                       |
      | that the alert changed in the meantime      | that the alert changed meanwhile, and to look at it again|
      | that the alert does not exist               | that the alert does not exist                            |

  @SC-16 @BR-08
  Scenario: Two clicks in the same instant send one request
    Given the person has chosen to change the Target Price of an Active alert
    When the person sends the form twice in the same instant
    Then one request is made to the application
    And while it is in progress the control cannot be used again

  # ---------------------------------------------------------------------------
  # Cancelling
  # ---------------------------------------------------------------------------

  @SC-17 @BR-06
  Scenario: Cancelling asks first, and going back sends nothing
    Given the person has an Active alert
    When the person chooses to cancel it
    Then the entry asks whether to cancel it, with a way to confirm and a way to go back
    And no request has been made
    When the person goes back
    Then the alert is as before and no request has been made

  @SC-18 @BR-06 @BR-08
  Scenario: Confirming cancels the alert, and the list is read again
    Given the person has an Active alert and has chosen to cancel it
    When the person confirms
    Then the application is asked to cancel it
    And the list is read again from the application
    And the alert shows the state Cancelled, with no way to change it or to cancel it

  @SC-19 @BR-07
  Scenario Outline: Each answer of cancelling has its own message
    Given the person has an Active alert and has chosen to cancel it
    When the person confirms and the application answers <answer>
    Then a message says <message>

    Examples:
      | answer                             | message                                  |
      | that the alert is no longer Active | that the alert is no longer Active       |
      | that the alert does not exist      | that the alert does not exist            |
      | that the alert changed in the meantime | that the alert changed meanwhile, and to look at it again |

  @SC-20 @BR-08
  Scenario: Two confirmations in the same instant send one request
    Given the person has an Active alert and has chosen to cancel it
    When the person confirms twice in the same instant
    Then one request is made to the application

  # ---------------------------------------------------------------------------
  # My notifications
  # ---------------------------------------------------------------------------

  @SC-21 @BR-09
  Scenario: A Notification states what happened
    Given the Price Alert of the person for "headphones-shop-a", with a Target Price of "80.00", was triggered by a price of "79.50" observed at a moment
    When the person opens "my notifications"
    Then the Notification shows the title and the Retailer of that Listing
    And it shows the Target Price "80.00", the Current Price "79.50" with its currency, and when it was observed

  @SC-22 @BR-09
  Scenario: The Notifications are listed newest first, one page at a time
    Given the person has 25 Notifications
    When the person opens "my notifications"
    Then the first 20 are listed, from the newest to the oldest, with a way to go to the next page
    When the person goes to the next page
    Then the remaining 5 are listed

  @SC-23 @BR-10
  Scenario: A person with no Notifications is told so
    Given the person has no Notifications
    When the person opens "my notifications"
    Then a message says that there are none

  @SC-24 @BR-10
  Scenario: The screen says that Notifications are stored and not sent
    When the person opens "my notifications"
    Then the screen says that they are the record of the alerts that reached their price
    And that nothing is sent anywhere else
    And no Notification has a mark of read, and the navigation shows no count

  # ---------------------------------------------------------------------------
  # When things go wrong
  # ---------------------------------------------------------------------------

  @SC-25 @BR-11
  Scenario Outline: A Session that ended takes the person to sign in
    Given the Session of the person ended
    When <action>
    Then the sign-in screen is shown
    And a message says that the session ended

    Examples:
      | action                                         |
      | the person opens "my alerts"                   |
      | the person opens "my notifications"            |
      | the person sends a new Target Price            |
      | the person confirms cancelling an alert        |

  @SC-26 @BR-11
  Scenario Outline: A failure that is not an answer of the application says that something failed
    Given the application cannot be reached, or answers with a failure that is not one of its answers
    When <action>
    Then a message says that something failed, and nothing of the cause
    And the person can try again

    Examples:
      | action                                         |
      | the person opens "my alerts"                   |
      | the person opens "my notifications"            |
      | the person sends a new Target Price            |
      | the person confirms cancelling an alert        |
