# language: en
# Feature 06 - Accounts and Authentication. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "Rejected" means that the request is not valid and nothing is changed. "Not valid" for a token
# means that it does not identify anybody: the request is refused because it is not authenticated.

Feature: Accounts and Authentication
  A person registers an Account, signs in to get a Session, and is recognised in their requests
  until the Session ends. Nobody can be recognised by anything that is fixed in the code.

  # ---------------------------------------------------------------------------
  # Registering
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-04
  Scenario: A person registers an Account
    Given nobody has registered the email "ana@example.com"
    When a person registers with the email "ana@example.com" and a valid password
    Then the Account is created
    And the answer shows its identifier and its email
    And the answer does not contain the password or anything made from it
    And the person is not signed in

  @SC-02 @BR-01 @BR-02
  Scenario Outline: An email that differs only in case or in surrounding spaces is the same email
    Given the email "ana@example.com" is registered
    When a person registers with the email "<email>" and a valid password
    Then the registration is rejected as a Conflict
    And no Account is created

    Examples:
      | email               |
      | ANA@example.com     |
      | Ana@Example.COM     |
      |   ana@example.com   |

  @SC-03 @BR-02
  Scenario: A rejected registration does not change the Account that exists
    Given the email "ana@example.com" is registered with the password "first-password-1"
    When a person registers with the email "ana@example.com" and the password "second-password-2"
    Then the registration is rejected as a Conflict
    And the owner can still sign in with "first-password-1"
    And nobody can sign in with "second-password-2"

  @SC-04 @BR-03
  Scenario Outline: A password has from 10 to 128 characters
    Given nobody has registered the email "ana@example.com"
    When a person registers with the email "ana@example.com" and a password of <length> characters
    Then <outcome>

    Examples:
      | length | outcome                                                              |
      | 9      | the registration is rejected because the password is too short       |
      | 10     | the Account is created                                               |
      | 128    | the Account is created                                               |
      | 129    | the registration is rejected because the password is too long        |

  @SC-05 @BR-03
  Scenario: A password cannot be the email
    Given nobody has registered the email "ana-garcia@example.com"
    When a person registers with the email "ana-garcia@example.com" and the password "ana-garcia@example.com"
    Then the registration is rejected because the password is the email
    And no Account is created

  @SC-06 @BR-01
  Scenario Outline: An email must look like an email
    When a person registers with the email "<email>" and a valid password
    Then the registration is rejected because the email is not valid
    And no Account is created

    Examples:
      | email                |
      |                      |
      | ana                  |
      | @example.com         |
      | ana@                 |
      | ana@@example.com     |

  # ---------------------------------------------------------------------------
  # Signing in
  # ---------------------------------------------------------------------------

  @SC-07 @BR-05 @BR-07
  Scenario: Signing in creates a Session and gives its token once
    Given the Account "ana@example.com" with the password "first-password-1"
    When the person signs in with that email and that password
    Then a Session is created for the Account
    And the answer gives the token of the Session
    And nothing that the system answers afterwards shows that token again

  @SC-08 @BR-01 @BR-05
  Scenario: The email is read the same way when signing in
    Given the Account "ana@example.com" with the password "first-password-1"
    When the person signs in with the email "  ANA@Example.com " and that password
    Then a Session is created for the Account

  @SC-09 @BR-05
  Scenario Outline: A failed sign-in does not tell what was wrong
    Given the Account "ana@example.com" with the password "first-password-1"
    When someone signs in with <credentials>
    Then the sign-in is refused because the email or the password is not valid
    And the answer is the same whatever the reason

    Examples:
      | credentials                                         |
      | the email "ana@example.com" and a wrong password    |
      | an email that nobody has registered                 |

  @SC-10 @BR-07
  Scenario: An Account can have several Sessions at once
    Given the Account "ana@example.com" with the password "first-password-1"
    When the person signs in twice
    Then there are two Sessions with two different tokens
    And both tokens identify the Account

  # ---------------------------------------------------------------------------
  # Repeated attempts
  # ---------------------------------------------------------------------------

  @SC-11 @BR-06
  Scenario: After 5 failed sign-ins in a row, attempts are refused for 15 minutes
    Given the Account "ana@example.com" with the password "first-password-1"
    And 5 failed sign-ins in a row for that email
    When someone signs in with that email and the right password
    Then the sign-in is refused because there have been too many attempts
    And the answer says how long to wait

  @SC-12 @BR-06
  Scenario: A successful sign-in resets the count
    Given the Account "ana@example.com" with the password "first-password-1"
    And 4 failed sign-ins in a row for that email
    And a successful sign-in
    When 4 more sign-ins fail
    Then the next sign-in with the right password creates a Session

  @SC-13 @BR-06
  Scenario: The account can be signed in to again 15 minutes after the fifth failure
    Given the Account "ana@example.com" with the password "first-password-1"
    And 5 failed sign-ins in a row for that email
    When 15 minutes have passed since the fifth
    Then signing in with the right password creates a Session

  @SC-14 @BR-06
  Scenario: The failures of one email do not affect another
    Given the Accounts "ana@example.com" and "luis@example.com"
    And 5 failed sign-ins in a row for "ana@example.com"
    When "luis@example.com" signs in with the right password
    Then a Session is created for "luis@example.com"

  @SC-15 @BR-05 @BR-06
  Scenario: An email that nobody registered is limited in the same way
    Given nobody has registered the email "ghost@example.com"
    And 5 failed sign-ins in a row for that email
    When someone signs in with that email
    Then the sign-in is refused because there have been too many attempts

  # ---------------------------------------------------------------------------
  # Being recognised
  # ---------------------------------------------------------------------------

  @SC-16 @BR-08
  Scenario: A request with the token of a Session is made by the User of its Account
    Given the Account "ana@example.com" has a Session
    When a request carries the token of that Session
    Then the request is made by the User of that Account

  @SC-17 @BR-08
  Scenario Outline: A request that does not carry a valid token is refused
    When a request that needs a User <what>
    Then the request is refused because it is not authenticated

    Examples:
      | what                                |
      | carries no token                    |
      | carries a token that nobody has     |
      | carries a token of the wrong kind   |

  @SC-18 @BR-07 @BR-08
  Scenario Outline: A Session lasts 7 days from its creation
    Given the Account "ana@example.com" has a Session created now
    When <time> have passed
    Then a request with its token <result>

    Examples:
      | time                       | result                     |
      | 6 days and 23 hours        | is made by the User        |
      | 7 days                     | is refused as not valid    |

  @SC-19 @BR-08 @BR-09
  Scenario: Signing out ends that Session and no other
    Given the Account "ana@example.com" has two Sessions
    When the person signs out with the token of the first
    Then a request with the token of the first is refused as not valid
    And a request with the token of the second is made by the User

  @SC-20 @BR-09
  Scenario: Signing out needs a Session that is valid
    Given the Account "ana@example.com" had a Session that was signed out
    When the person signs out with the token of that Session
    Then the request is refused because it is not authenticated

  # ---------------------------------------------------------------------------
  # Reading one's own account
  # ---------------------------------------------------------------------------

  @SC-21 @BR-04 @BR-10
  Scenario: A User reads their own Account
    Given the Account "ana@example.com" has a Session
    When the User reads their own Account
    Then the answer shows the identifier and the email of the Account
    And the answer does not contain the password or anything made from it

  # ---------------------------------------------------------------------------
  # With the rest of the system
  # ---------------------------------------------------------------------------

  @SC-22 @BR-11
  Scenario Outline: The credentials of a User and of a Provider are not interchangeable
    Given a User with a Session
    And a Provider with its credential
    When <who> tries <what>
    Then the request is refused because it is not authenticated

    Examples:
      | who               | what                                   |
      | the User          | to record a Price Observation          |
      | the Provider      | to read the Account of a User          |
      | the Provider      | to read the Price History              |

  @SC-23 @BR-08
  Scenario Outline: The Session of a User opens what a User can use
    Given a User with a Session
    When the User <does>
    Then the request is made by the User of the Account

    Examples:
      | does                                 |
      | creates a Price Alert                |
      | reads their Price Alerts             |
      | reads their Notifications            |
      | reads the Price History of a Listing |

  @SC-24 @BR-12
  Scenario: The development server starts with two Accounts to try
    Given the development server has just started
    Then two Accounts exist whose emails and passwords are documented
    And each of them can sign in
    And the first owns the demo Price Alert
    And the fixed tokens that stood for Users before are not valid
