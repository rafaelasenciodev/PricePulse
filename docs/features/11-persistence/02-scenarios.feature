# language: en
# Feature 11 - Persistence. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable behaviour in the project's ubiquitous language. Each scenario has an identifier
# (@SC-nn) and the business rules it exercises (@BR-nn). Rules: 01-discovery.md, section 6.
#
# This feature changes where data is kept and nothing else, so most scenarios say that something that was already
# true is still true with a database: after a restart, with two requests at the same time, in the same order.
# "The database" is the one of Q2 of the discovery. "The server is restarted" means that it is stopped and started
# again against the same database. "At the same time" means that the second request starts before the first one
# has been answered. The Accounts, Listings and prices are those that each scenario creates.

Feature: Persistence
  What the system stores lasts. A person finds their Account, Session, Price Alerts and Notifications where they
  left them, and the guarantees that held in memory, uniqueness, one change at a time and the order of the lists,
  are held by the database.

  Background:
    Given the application runs against an empty database that has its schema
    And the Listing "headphones-shop-a" in EUR, with a Current Price of "100.00"

  # ---------------------------------------------------------------------------
  # What is stored survives a restart
  # ---------------------------------------------------------------------------

  @SC-01 @BR-02
  Scenario: An Account and its Session survive a restart
    Given Ana registered with "ana@example.com" and signed in
    When the server is restarted
    Then the token that Ana had still identifies her
    And Ana can also sign in again with her password

  @SC-02 @BR-02
  Scenario: A Session that ended stays ended after a restart
    Given Ana signed in and then signed out
    When the server is restarted
    Then the token that Ana had does not identify her

  @SC-03 @BR-02
  Scenario: The sign-in attempts of an email are counted across a restart
    Given 4 sign-ins in a row failed for "ana@example.com"
    When the server is restarted
    And one more sign-in fails for "ana@example.com"
    Then the email is locked, as it would be after 5 failures without a restart

  @SC-04 @BR-02
  Scenario: A Price Alert is found as it was left
    Given Ana has an Active Price Alert for "headphones-shop-a" with a Target Price of "80.00"
    When the server is restarted
    Then Ana reads the same alert: its identifier, its Listing, its Target Price, its state and its creation moment

  @SC-05 @BR-02
  Scenario Outline: Notifications, prices and the Catalogue survive a restart
    Given Ana has an alert for "headphones-shop-a" with a Target Price of "80.00"
    And a Provider recorded a price of "79.00" for it, which triggered the alert
    When the server is restarted
    Then <what> is as it was before

    Examples:
      | what                                                       |
      | the Notification of Ana                                    |
      | the Price History of "headphones-shop-a"                   |
      | the Current Price of "headphones-shop-a" in the Catalogue  |
      | the title and the Retailer of "headphones-shop-a"          |
      | the state of the alert, which is Triggered                 |

  # ---------------------------------------------------------------------------
  # Nothing observable changes
  # ---------------------------------------------------------------------------

  @SC-06 @BR-01
  Scenario: A whole journey gives the same answers as in memory
    Given a person who registers, signs in and reads the Catalogue
    When they create a Price Alert for "headphones-shop-a" with a Target Price of "80.00"
    And a Provider records a price of "79.00" for it
    And the person reads their Notifications, lowers the Target Price of another alert and cancels it
    Then every answer, with its status, its code and its body, is the one that the same journey gives in memory

  # ---------------------------------------------------------------------------
  # Uniqueness is held by the database
  # ---------------------------------------------------------------------------

  @SC-07 @BR-03
  Scenario: Two registrations of the same email at the same time leave one Account
    When two people register with "ana@example.com" at the same time
    Then one registration succeeds
    And the other is told that the email is registered
    And there is one Account with that email

  @SC-08 @BR-03
  Scenario: An email is the same whatever its capitals and its spaces
    Given Ana registered with "ana@example.com"
    When someone registers with " Ana@Example.COM "
    Then they are told that the email is registered

  @SC-09 @BR-03
  Scenario: Two requests for the same Price Alert at the same time leave one
    When Ana asks for a Price Alert for "headphones-shop-a" with a Target Price of "80.00" twice at the same time
    Then both answers are the same Price Alert, one created and one that already existed
    And Ana has one Active Price Alert for that Listing

  @SC-10 @BR-03
  Scenario Outline: A new Active alert is allowed once the earlier one has ended
    Given Ana has a Price Alert for "headphones-shop-a" that is <state>
    When Ana asks for a Price Alert for "headphones-shop-a" with a Target Price of "70.00"
    Then it is created, and Ana has one Active Price Alert for that Listing

    Examples:
      | state     |
      | Cancelled |
      | Triggered |

  @SC-11 @BR-03
  Scenario: Two Evaluations of the same Listing at the same time leave one Notification per alert
    Given Ana has an Active alert for "headphones-shop-a" with a Target Price of "80.00"
    When a Provider records a price of "79.00" for it twice at the same time
    Then Ana has one Notification for that alert
    And the alert is Triggered

  @SC-12 @BR-03
  Scenario: The same Price Observation recorded twice at the same time is stored once
    When a Provider records a price of "79.00" for "headphones-shop-a" at 10:00:00 twice at the same time
    Then both are answered as the same Price Observation
    And the Price History has one observation at 10:00:00

  @SC-13 @BR-03
  Scenario: The same observation with another content is a Conflict
    Given a Provider recorded a price of "79.00" for "headphones-shop-a" at 10:00:00
    When the same Provider records a price of "75.00" for it at 10:00:00
    Then it is told that an observation with that identity is stored with another content
    And the Price History still says "79.00" for that moment

  # ---------------------------------------------------------------------------
  # One change at a time
  # ---------------------------------------------------------------------------

  @SC-14 @BR-04
  Scenario: A cancel and a Triggering at the same time leave the alert in one end state
    Given Ana has an Active alert for "headphones-shop-a" with a Target Price of "80.00"
    When Ana cancels it and a Provider records a price of "79.00" for it at the same time
    Then the alert is Cancelled or Triggered, and not both
    And whichever request came second did not change what the first one left

  @SC-15 @BR-04
  Scenario: Two cancels at the same time both succeed
    Given Ana has an Active alert for "headphones-shop-a"
    When Ana cancels it twice at the same time
    Then both succeed and the alert is Cancelled

  @SC-16 @BR-04
  Scenario: Two changes of the Target Price at the same time both succeed and the last one stays
    Given Ana has an Active alert for "headphones-shop-a" with a Target Price of "80.00"
    When Ana changes the Target Price to "70.00" and to "60.00" at the same time
    Then both succeed
    And the stored Target Price is one of the two, the one that was written last

  @SC-17 @BR-05
  Scenario: Failed sign-ins at the same time are all counted
    When 5 sign-ins with a wrong password for "ana@example.com" arrive at the same time
    Then the email is locked
    And no attempt was lost

  # ---------------------------------------------------------------------------
  # The order and the pages are those of the contracts
  # ---------------------------------------------------------------------------

  @SC-18 @BR-06
  Scenario: The Price Alerts are listed newest first, and two of the same moment by identifier
    Given Ana has 25 Price Alerts, and two of them were created at the same moment
    When Ana reads her first page of 20 and then her second page
    Then the alerts come from the newest to the oldest, and the two of the same moment by identifier
    And no alert is missing or repeated across the two pages
    And the total is 25 in both

  @SC-19 @BR-06
  Scenario: The Notifications are listed by the moment their price was observed, newest first
    Given Ana has Notifications for prices observed at different moments, and two at the same moment
    When Ana reads her Notifications
    Then they come from the newest Observed At to the oldest, and the two of the same moment by the identifier of their alert

  @SC-20 @BR-06
  Scenario: The Price History is newest first, limited by a range, with Observed At from included to excluded
    Given observations of "headphones-shop-a" at 08:00, 09:00, 10:00 and 11:00, and two Providers at 10:00
    When a person reads the history from 09:00 up to 11:00
    Then it has the observations at 09:00 and 10:00, with the two at 10:00 by Provider, newest first
    And the total counts those that the range includes

  @SC-21 @BR-06
  Scenario Outline: The Catalogue is ordered by the lower-cased title, by the codes of its characters, and then by identifier
    Given Listings with the titles <titles>
    When a person reads the Catalogue
    Then the titles come in the order <order>
    And it is the same on every machine

    Examples:
      | titles                         | order                          |
      | "banana", "Apple", "cherry"    | "Apple", "banana", "cherry"    |
      | "eclair", "Éclair", "zebra"    | "eclair", "zebra", "Éclair"    |
      | "Item 10", "Item 9", "item 1"  | "item 1", "Item 10", "Item 9"  |

  @SC-22 @BR-06
  Scenario: Two Listings with the same title are ordered by identifier
    Given the Listings "same-b" and "same-a", both titled "Same"
    When a person reads the Catalogue
    Then "same-a" comes before "same-b"

  @SC-23 @BR-06
  Scenario: A page of the Catalogue says the total of all the Listings, not of the page
    Given 45 Listings
    When a person reads the page of 20 that starts at the 41st
    Then the page has 5 Listings and the total is 45

  # ---------------------------------------------------------------------------
  # What is stored is exact
  # ---------------------------------------------------------------------------

  @SC-24 @BR-08
  Scenario Outline: A Target Price and a price come back with the text they were given
    Given a Price Alert and a price recorded with the amount <amount>
    When they are read
    Then the amount is <amount>, with no digit more and none less

    Examples:
      | amount       |
      | "0.01"       |
      | "79.90"      |
      | "1234567.89" |

  @SC-25 @BR-08
  Scenario: The moment of an observation comes back to the millisecond
    Given a price recorded as observed at "2026-11-19T10:00:00.123Z"
    When the Price History is read
    Then the moment is "2026-11-19T10:00:00.123Z"

  @SC-26 @BR-08
  Scenario: A password and a token are never stored in clear
    Given Ana registered with a password and signed in
    When what the database holds is read directly
    Then her password is nowhere, and her stored password is a hash
    And her token is nowhere, and her Session is found only by the hash of the token

  # ---------------------------------------------------------------------------
  # The core knows nothing of the database
  # ---------------------------------------------------------------------------

  @SC-27 @BR-09
  Scenario: The domain and the application do not import the driver of the database
    Given the source of the application
    Then no file of the domain or of the application of any module names the driver
    And only the adapters and the Composition Root do

  # ---------------------------------------------------------------------------
  # Contracts
  # ---------------------------------------------------------------------------

  @SC-28 @BR-07
  Scenario Outline: Every port passes its contract with the database adapter
    Given the contract of <port>, which the in-memory adapter passes
    When it is run against the database adapter
    Then every check passes

    Examples:
      | port                  |
      | AccountRepository     |
      | SessionStore          |
      | LoginAttemptStore     |
      | PriceAlertRepository  |
      | NotificationRepository|
      | PriceObservationRepository |
      | ListingCatalogue      |

  @SC-29 @BR-07
  Scenario: The contracts against the database are not skipped when there is no database
    Given no database can be reached
    When the contracts of the database adapters are run
    Then the run fails, and says that it could not connect
    And no check is reported as passed or as skipped

  # ---------------------------------------------------------------------------
  # How the server connects
  # ---------------------------------------------------------------------------

  @SC-30 @BR-10
  Scenario: With a connection the server uses the database
    Given the address of a database in the environment
    When the server starts
    Then it keeps its data in that database
    And it says at which database, without its password

  @SC-31 @BR-10
  Scenario: Without a connection the server runs in memory and says so
    Given no address of a database in the environment
    When the server starts
    Then it runs with its data in memory
    And it says clearly that what it stores is lost when it stops

  @SC-32 @BR-10
  Scenario: Production does not start without a database
    Given no address of a database in the environment
    And the environment says that this is production
    When the server starts
    Then it does not start, and says why

  @SC-33 @BR-10
  Scenario: A database that cannot be reached stops the server, and its password is not shown
    Given the address of a database that cannot be reached, with a password in it
    When the server starts
    Then it does not start, and says that it could not connect
    And the password is in no message and in no log

  # ---------------------------------------------------------------------------
  # The schema changes in steps
  # ---------------------------------------------------------------------------

  @SC-34 @BR-11
  Scenario: An empty database gets every step, in order
    Given a database with no schema and 3 numbered steps
    When the steps are applied
    Then each one has been applied once, in the order of its number
    And each one is recorded

  @SC-35 @BR-11
  Scenario: A step that was applied is not applied again
    Given a database whose 3 steps were applied
    When the server is started again
    Then no step is applied
    And the data is as it was

  @SC-36 @BR-11
  Scenario: Only the steps that are missing are applied
    Given a database whose steps 1 and 2 were applied, and a new step 3
    When the steps are applied
    Then only step 3 is applied, and the data of steps 1 and 2 is as it was

  @SC-37 @BR-11
  Scenario: A step that fails leaves the database as it was before that step
    Given a database whose steps 1 and 2 were applied, and a step 3 that fails half way
    When the steps are applied
    Then the server does not start, and says which step failed
    And nothing of step 3 stays, and step 3 is not recorded

  # ---------------------------------------------------------------------------
  # The demo data and the Sessions
  # ---------------------------------------------------------------------------

  @SC-38 @BR-12
  Scenario: The demo data is created once
    Given the demo server started for the first time and created its data
    When it is started again
    Then there are two demo Accounts, six Listings, their first prices and one demo alert, and no more

  @SC-39 @BR-12
  Scenario: A restart does not undo what a person did to the demo data
    Given the demo data exists, and "demo1@example.com" cancelled the demo alert
    And a Provider recorded a new price for "headphones-shop-a"
    When the server is restarted
    Then the demo alert is still Cancelled, and the Current Price is the one that was recorded last

  @SC-40 @BR-13
  Scenario: Signing in removes the Sessions that expired
    Given Ana has a Session that expired and Luis has a Session that is valid
    When Ana signs in again
    Then the Session that expired is no longer stored
    And the Session of Luis and the new one of Ana are
