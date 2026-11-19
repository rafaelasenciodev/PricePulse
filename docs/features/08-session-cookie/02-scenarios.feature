# language: en
# Feature 08 - Session Cookie. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "The cookie is on" means that the application was given its own origin, here "http://app.example", which is
# the only one it accepts. "A read" is a GET or a HEAD, and "a change" is any other request. "Refused" means
# that the request is not carried out and nothing is changed. "Not authenticated" means that it does not carry a
# valid token of a User, in the header or in the cookie.
# The Session cookie is called "the cookie" when it is not ambiguous. Its name is "pricepulse_session", and in the
# examples TOKEN stands for the token of the Session of the person who signed in.

Feature: Session Cookie
  A person signs in once in a browser and is recognised by every later request, with no script holding the
  token. A request that only the cookie authenticates must come from the pages of the application itself.

  Background:
    Given the cookie is on, for the origin "http://app.example"
    And the Account "ana@example.com" with the password "first-password-1"

  # ---------------------------------------------------------------------------
  # Setting the cookie
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02
  Scenario: Signing in sets the cookie, and the answer still has the token
    When the person signs in
    Then a Session is created
    And the answer has the token of the Session in its body
    And the answer sets the cookie "pricepulse_session" with that same token
    And the cookie cannot be read by scripts
    And the cookie is not sent with a request that another site makes
    And the cookie is for every path of the application

  @SC-02 @BR-02
  Scenario: The cookie lasts as long as the Session has left
    When the person signs in
    Then the cookie lasts 7 days, which is the life of the Session

  @SC-03 @BR-02
  Scenario Outline: The cookie is marked as secure when the application is set to be served over HTTPS
    Given the application is set <setting>
    When the person signs in
    Then the cookie <secure>

    Examples:
      | setting                    | secure              |
      | to be served over HTTPS    | is marked as secure |
      | not to be served over HTTPS | is not marked as secure |

  @SC-04 @BR-03
  Scenario Outline: A sign-in that fails sets no cookie
    Given <state>
    When someone signs in <how>
    Then the sign-in is refused
    And the answer sets no cookie

    Examples:
      | state                                  | how                                  |
      | nothing else                           | with a wrong password                |
      | nothing else                           | with an email that has no Account    |
      | 5 failed sign-ins in a row for the email | with the right password            |
      | nothing else                           | with a body that is not valid        |

  # ---------------------------------------------------------------------------
  # Being recognised by the cookie
  # ---------------------------------------------------------------------------

  @SC-05 @BR-04
  Scenario Outline: A request to a route of Users that carries only the cookie is made by that User
    Given the person signed in and their browser holds the cookie
    When the browser reads <what>, with the cookie and no header
    Then the request is made by the User of the Account

    Examples:
      | what                                 |
      | their Account                        |
      | their Price Alerts                   |
      | their Notifications                  |
      | the Price History of a Listing       |
      | the Catalogue                        |

  @SC-06 @BR-04
  Scenario Outline: The cookie is found among other cookies, and only by its own name
    Given the person signed in
    When a request carries the cookie header <cookies>
    Then the request <result>

    Examples:
      | cookies                                              | result                              |
      | pricepulse_session=TOKEN                           | is made by the User                 |
      | theme=dark; pricepulse_session=TOKEN; lang=en      | is made by the User                 |
      | pricepulse_session=                                  | is not authenticated                |
      | other_session=TOKEN                                | is not authenticated                |
      | pricepulse_session_old=TOKEN                       | is not authenticated                |

  @SC-07 @BR-04
  Scenario Outline: A cookie that does not hold the token of a valid Session does not authenticate
    Given the person signed in and then <what>
    When the browser reads their Account, with the cookie and no header
    Then the request is not authenticated

    Examples:
      | what                                |
      | signed out                          |
      | 7 days passed                       |
      | the cookie was changed to a value that nobody has |

  @SC-08 @BR-05
  Scenario: When a request has both, only the header is read
    Given the Accounts "ana@example.com" and "luis@example.com", each with a Session
    When a request carries the header of "luis@example.com" and the cookie of "ana@example.com"
    Then the request is made by "luis@example.com"

  @SC-09 @BR-05
  Scenario: A header that is not valid is not replaced by the cookie
    Given the person signed in and their browser holds the cookie
    When a request carries a header with a token that nobody has, and the cookie
    Then the request is not authenticated

  @SC-10 @BR-06
  Scenario Outline: The cookie never identifies a Provider
    Given a Provider with its credential
    And a User with a Session
    When a request to record a Price Observation carries <credential> in the cookie and no header
    Then the request is not authenticated

    Examples:
      | credential                    |
      | the credential of the Provider |
      | the token of the Session       |

  @SC-11 @BR-06
  Scenario: The Provider still records a price with its credential in the header
    Given a Provider with its credential
    When it records a Price Observation with its credential in the header and the cookie of a User
    Then the Price Observation is recorded for the Provider

  # ---------------------------------------------------------------------------
  # Requests forged from another site
  # ---------------------------------------------------------------------------

  @SC-12 @BR-07
  Scenario Outline: A change that the cookie authenticates is carried out when it comes from the application's own pages
    Given the person signed in and their browser holds the cookie
    When the browser makes <change>, with the cookie, the origin "http://app.example" and no header
    Then the change is carried out as the User

    Examples:
      | change                                  |
      | a request to create a Price Alert       |
      | a request to change a Target Price      |
      | a request to cancel a Price Alert       |
      | a request to sign out                   |

  @SC-13 @BR-07
  Scenario Outline: A change that the cookie authenticates is refused when it does not come from the application's own pages
    Given the person signed in and their browser holds the cookie
    When a request to create a Price Alert carries the cookie and <origin>
    Then the request is refused
    And no Price Alert is created

    Examples:
      | origin                                     |
      | the origin "http://evil.example"           |
      | the origin "http://app.example:3001", which is another port of the same host |
      | the origin "https://app.example", which is another scheme |
      | the origin "null"                          |
      | no origin                                  |

  @SC-14 @BR-07
  Scenario: A refused request to sign out leaves the Session
    Given the person signed in and their browser holds the cookie
    When a request to sign out carries the cookie and the origin "http://evil.example"
    Then the request is refused
    And the Session is still valid

  @SC-15 @BR-07
  Scenario Outline: A read that the cookie authenticates is answered whatever the origin
    Given the person signed in and their browser holds the cookie
    When a request to read their Price Alerts carries the cookie and <origin>
    Then the request is made by the User

    Examples:
      | origin                           |
      | no origin                        |
      | the origin "http://app.example"  |
      | the origin "http://evil.example" |

  @SC-16 @BR-07 @BR-11
  Scenario Outline: A change that the header authenticates is not subject to the origin
    Given the person signed in
    When a request to create a Price Alert carries the token in the header and <origin>
    Then the Price Alert is created

    Examples:
      | origin                           |
      | no origin                        |
      | the origin "http://evil.example" |

  @SC-17 @BR-08
  Scenario Outline: Signing in or registering from another origin is refused
    When a request to <action> carries <origin>
    Then the request is refused
    And no Session and no Account is created
    And the answer sets no cookie

    Examples:
      | action      | origin                                     |
      | sign in     | the origin "http://evil.example"           |
      | sign in     | the origin "http://app.example:3001"       |
      | sign in     | the origin "null"                          |
      | register    | the origin "http://evil.example"           |
      | register    | the origin "null"                          |

  @SC-18 @BR-08
  Scenario Outline: Signing in or registering from the application's pages, or from a program with no origin, is accepted
    When a request to <action> carries <origin>
    Then the request is carried out

    Examples:
      | action      | origin                           |
      | sign in     | the origin "http://app.example"  |
      | sign in     | no origin                        |
      | register    | the origin "http://app.example"  |
      | register    | no origin                        |

  # ---------------------------------------------------------------------------
  # Signing out
  # ---------------------------------------------------------------------------

  @SC-19 @BR-09
  Scenario: Signing out clears the cookie
    Given the person signed in and their browser holds the cookie
    When the browser signs out, with the cookie and the origin "http://app.example"
    Then the Session ends
    And the answer clears the cookie, with the same name, path and attributes and a life of zero
    And the next request with that cookie is not authenticated

  @SC-20 @BR-09
  Scenario: Signing out with the token in the header also clears the cookie
    Given the person signed in
    When a request to sign out carries the token in the header
    Then the Session ends
    And the answer clears the cookie

  @SC-21 @BR-09
  Scenario Outline: A sign-out whose cookie is not valid answers 401 and clears the cookie
    Given the person signed in and then <what>
    When the browser signs out, with the cookie and the origin "http://app.example"
    Then the request is not authenticated
    And the answer clears the cookie

    Examples:
      | what                                              |
      | signed out in another place                       |
      | 7 days passed                                     |
      | the cookie was changed to a value that nobody has |

  @SC-22 @BR-09
  Scenario: A request that is not authenticated leaves the cookie as it is
    Given the person signed in and then signed out in another place
    When the browser reads their Price Alerts, with the cookie
    Then the request is not authenticated
    And the answer neither sets nor clears the cookie

  # ---------------------------------------------------------------------------
  # What does not change
  # ---------------------------------------------------------------------------

  @SC-23 @BR-10
  Scenario: Without the origin, nothing is set and nothing is read
    Given the cookie is off, because the application was not given its origin
    When the person signs in
    Then the answer has the token in its body and sets no cookie
    When a request to read their Account carries the cookie "pricepulse_session" with that token and no header
    Then the request is not authenticated

  @SC-24 @BR-11
  Scenario: A client that sends the token in the header works as it did
    Given the person signed in, and keeps no cookie
    When the client creates a Price Alert, lists their Price Alerts, changes a Target Price, cancels it, reads their Notifications, the Catalogue and a Price History, reads their Account and signs out, all with the token in the header
    Then each request is answered as it was before this feature
