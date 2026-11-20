# language: en
# Feature 09 - Web Interface. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable behaviour of the interface in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "The person" is whoever uses the interface in a browser, and "the application" is the backend that the
# interface talks to. A "message" is a text of the interface in Spanish: the scenarios say what it tells and
# the design fixes its words. "Signed in" means that the browser holds the cookie of a Session that is valid.
# The interface is reached at "/app/". The Catalogue and the Accounts are those of the demo server.
# In the examples of files, HASH stands for the hash that the build adds to the name of a file.

Feature: Web Interface
  A person registers, signs in, looks at the Catalogue, chooses a Listing and asks to be told when it reaches a
  price, from a browser. The page never holds the token of the Session: the cookie does.

  Background:
    Given the application serves the interface
    And the Accounts "demo1@example.com" with the password "demo-password-1" and "demo2@example.com"
    And the Catalogue has six Listings

  # ---------------------------------------------------------------------------
  # Who sees what
  # ---------------------------------------------------------------------------

  @SC-01 @BR-02
  Scenario Outline: A person who is not signed in sees only the screens to sign in and to register
    Given the person is not signed in
    When the person opens the address "<address>"
    Then the sign-in screen is shown
    And the screen has a way to go to the registration screen

    Examples:
      | address                         |
      | /app/                           |
      | /app/catalogue                  |
      | /app/listings/headphones-shop-a |
      | /app/an/address/that/is/not/one |

  @SC-02 @BR-02
  Scenario: A person who is signed in is taken from the screen to sign in to the Catalogue
    Given the person is signed in
    When the person opens the sign-in address
    Then the Catalogue is shown

  # ---------------------------------------------------------------------------
  # Signing in
  # ---------------------------------------------------------------------------

  @SC-03 @BR-03
  Scenario: Signing in with the right email and password leads to the Catalogue
    Given the person is on the sign-in screen
    When the person signs in with "demo1@example.com" and "demo-password-1"
    Then the Catalogue is shown
    And the screen offers a way to sign out

  @SC-04 @BR-03
  Scenario Outline: A failed sign-in says the same whatever was wrong
    Given the person is on the sign-in screen
    When the person signs in with <credentials>
    Then a message says that the email or the password is not valid
    And it does not say which of the two it was
    And the person stays on the sign-in screen

    Examples:
      | credentials                                   |
      | "demo1@example.com" and a wrong password      |
      | an email that has no Account and any password |

  @SC-05 @BR-03
  Scenario: A locked email shows how many seconds to wait
    Given 5 sign-ins in a row failed for "demo1@example.com"
    When the person signs in with "demo1@example.com" and "demo-password-1"
    Then a message says that there have been too many attempts
    And it says how many seconds to wait, as the application answered
    And the person stays on the sign-in screen

  @SC-06 @BR-14
  Scenario Outline: A form with an empty field is not sent, and says which field is missing
    Given the person is on <screen>
    When the person sends the form with <missing> empty
    Then no request is made to the application
    And a message says that <missing> is needed

    Examples:
      | screen                           | missing           |
      | the sign-in screen               | the email         |
      | the sign-in screen               | the password      |
      | the registration screen          | the email         |
      | the registration screen          | the password      |
      | the screen of a Listing          | the target price  |

  @SC-07 @BR-01
  Scenario: The page does not hold the token of the Session
    Given the person signed in
    When the person uses the screens of the interface
    Then the token is not kept in the memory of the page, in the storage of the browser or in any address
    And no request of the interface carries an Authorization header
    And every request of the interface that needs a User is sent with the cookie of the browser

  # ---------------------------------------------------------------------------
  # Registering
  # ---------------------------------------------------------------------------

  @SC-08 @BR-04
  Scenario: Registering signs the person in and leads to the Catalogue
    Given the person is on the registration screen
    When the person registers with "eve@example.com" and a valid password
    Then the Account is created
    And the person is signed in with the same email and password
    And the Catalogue is shown

  @SC-09 @BR-04
  Scenario Outline: Registering says what is wrong
    Given the person is on the registration screen
    When the person registers with <email> and <password>
    Then a message says <what>
    And no Account is created
    And the person stays on the registration screen

    Examples:
      | email                 | password                     | what                                   |
      | "eve"                 | "valid-password-1"           | that the email is not valid            |
      | "eve@example.com"     | "short"                      | that the password is too short         |
      | "eve@example.com"     | a password of 129 characters | that the password is too long          |
      | "eve@example.com"     | "eve@example.com"            | that the password cannot be the email  |
      | "demo1@example.com"   | "valid-password-1"           | that the email is already registered   |

  @SC-10 @BR-04 @BR-12
  Scenario: The Account is created and the sign-in that follows fails
    Given the person is on the registration screen
    And the application does not answer the sign-in that follows the registration
    When the person registers with "eve@example.com" and a valid password
    Then a message says that the Account was created and that the person must sign in
    And the sign-in screen is shown with "eve@example.com" already written

  @SC-11 @BR-11
  Scenario: A form that is being sent cannot be sent again
    Given the person is on the registration screen
    When the person sends the form twice in a row, before the application answers
    Then the application receives one registration
    And the button that sends the form cannot be used until the answer comes

  # ---------------------------------------------------------------------------
  # Signing out and the end of the Session
  # ---------------------------------------------------------------------------

  @SC-12 @BR-05
  Scenario: Signing out ends the Session at the application and shows the sign-in screen
    Given the person is signed in
    When the person signs out
    Then the application ends the Session
    And the sign-in screen is shown
    And going back in the browser does not show any screen of the signed-in person

  @SC-13 @BR-05 @BR-12
  Scenario: A sign-out that the application does not confirm leaves the person signed in
    Given the person is signed in
    And the application does not answer
    When the person signs out
    Then a message says that the Session could not be ended
    And the person is still on the same screen

  @SC-14 @BR-06
  Scenario Outline: An answer that the Session is not valid takes the person to the sign-in screen
    Given the person is signed in and the Session ended in another place
    When the person <does>
    Then the sign-in screen is shown
    And a message says that the session ended
    And nothing that the person had written is kept

    Examples:
      | does                                       |
      | opens the Catalogue                        |
      | goes to the next page of the Catalogue     |
      | opens the screen of a Listing              |
      | creates a Price Alert                      |
      | signs out                                  |

  # ---------------------------------------------------------------------------
  # The Catalogue
  # ---------------------------------------------------------------------------

  @SC-15 @BR-07
  Scenario: The Catalogue shows each Listing with its title, Retailer and Current Price
    Given the person is signed in
    And "headphones-shop-a" is titled "Wireless headphones" by "Shop A", with the Current Price 100.00 EUR observed at "2026-11-19T10:00:00Z"
    When the person opens the Catalogue
    Then "Wireless headphones" is shown, with "Shop A", the price 100.00 EUR and the moment it was observed

  @SC-16 @BR-07
  Scenario: A Listing with no Current Price says that it has none
    Given the person is signed in
    And "monitor-shop-a" has no Current Price
    When the person opens the Catalogue
    Then "monitor-shop-a" says that it has no price
    And it does not show 0.00 or an empty price

  @SC-17 @BR-07
  Scenario: The Listings come in the order that the application gives them
    Given the person is signed in
    When the person opens the Catalogue
    Then the Listings are shown in the order of the answer, by title and then by identifier
    And the interface does not sort them again

  @SC-18 @BR-07
  Scenario: The Catalogue is read one page at a time
    Given the person is signed in
    And the Catalogue has 25 Listings
    When the person opens the Catalogue
    Then 20 Listings are shown, and which ones they are among the 25
    And there is a way to go to the next page and none to go back
    When the person goes to the next page
    Then the other 5 are shown
    And there is a way to go back and none to go on

  @SC-19 @BR-07
  Scenario: An empty Catalogue says that there is nothing yet
    Given the person is signed in
    And the Catalogue has no Listings
    When the person opens the Catalogue
    Then a message says that there are no Listings yet

  @SC-20 @BR-07 @BR-12
  Scenario Outline: A Catalogue that cannot be read says so, and can be tried again
    Given the person is signed in
    And the application <fails>
    When the person opens the Catalogue
    Then a message says that the Listings could not be read, and nothing of the cause
    And there is a way to try again
    And trying again, when the application answers, shows the Catalogue

    Examples:
      | fails                          |
      | does not answer                |
      | answers with an unexpected failure |

  # ---------------------------------------------------------------------------
  # One Listing and creating a Price Alert
  # ---------------------------------------------------------------------------

  @SC-21 @BR-08
  Scenario: A Listing has its own screen, with its data and a form for a Price Alert
    Given the person is signed in and is on the Catalogue
    When the person chooses "headphones-shop-a"
    Then its title, its Retailer, its Current Price and the moment it was observed are shown
    And a form asks for a target price, in the currency "EUR" of the Listing
    And there is a way to go back to the Catalogue

  @SC-22 @BR-08
  Scenario: A Listing that is not in the Catalogue says so
    Given the person is signed in
    When the person opens the address of the Listing "no-such-listing"
    Then a message says that the Listing does not exist
    And there is a way to go to the Catalogue

  @SC-23 @BR-09 @BR-10
  Scenario: A valid target creates the Price Alert
    Given the person is signed in and is on the screen of "headphones-shop-a", whose Current Price is 100.00 EUR
    When the person asks for the target price "80.00"
    Then a message says that the Price Alert was created, with its target 80.00 EUR

  @SC-24 @BR-10
  Scenario: Asking again for the same Price Alert says that it already existed
    Given the person has an Active Price Alert for "headphones-shop-a" with the target 80.00 EUR
    When the person asks for the target price "80.00" on the screen of "headphones-shop-a"
    Then a message says that the person already had that Price Alert
    And it is not shown as new

  @SC-25 @BR-10
  Scenario Outline: A request that the application refuses says why
    Given the person is signed in and is on the screen of "headphones-shop-a", whose Current Price is 100.00 EUR
    And <state>
    When the person asks for the target price "<amount>"
    Then a message says <what>
    And what the person wrote is still in the form

    Examples:
      | state                                                              | amount | what                                                                  |
      | the person has an Active Price Alert for it with the target 70.00  | 80.00  | that there is already an Active Price Alert for it, with another target |
      | nothing else                                                       | 100.00 | that the Current Price already reaches that target                    |
      | nothing else                                                       | 120.00 | that the Current Price already reaches that target                    |

  @SC-26 @BR-09 @BR-10
  Scenario Outline: An amount that is not valid says so, and how an amount is written
    Given the person is signed in and is on the screen of "headphones-shop-a"
    When the person asks for the target price "<amount>"
    Then a message says that the amount is not valid
    And it says that the decimals are written with a point, as in 80.00
    And what the person wrote is still in the form

    Examples:
      | amount  |
      | abc     |
      | 0       |
      | -5      |
      | 80.001  |
      | 80,00   |

  @SC-27 @BR-09
  Scenario Outline: The amount is sent as the text that the person wrote, trimmed
    Given the person is signed in and is on the screen of "headphones-shop-a"
    When the person writes "<written>" as the target price and sends the form
    Then the request carries the text "<sent>" and not a number
    And the interface does not decide whether it is valid

    Examples:
      | written    | sent  |
      | 80.00      | 80.00 |
      |   80.00    | 80.00 |
      | 80.50      | 80.50 |
      | 80.5       | 80.5  |
      | 080.00     | 080.00 |

  @SC-28 @BR-11
  Scenario: While a Price Alert is being created, the form cannot be sent again
    Given the person is signed in and is on the screen of "headphones-shop-a"
    When the person sends the form twice in a row, before the application answers
    Then the application receives one request
    And the button that sends the form cannot be used until the answer comes

  @SC-29 @BR-11
  Scenario: What is shown is read again from the application after a Price Alert is created
    Given the person is signed in and is on the screen of "headphones-shop-a", whose Current Price is 100.00 EUR
    And a price of 79.90 EUR is recorded for it after the screen was opened
    When the person asks for the target price "80.00"
    Then the screen shows the Current Price that the application has now, 79.90 EUR
    And it does not show a price that the interface worked out

  @SC-30 @BR-12
  Scenario Outline: A Price Alert that cannot be created for a reason that is not an answer says so, and keeps what was written
    Given the person is signed in and is on the screen of "headphones-shop-a"
    And the application <fails>
    When the person asks for the target price "80.00"
    Then a message says that something failed and that the person can try again, and nothing of the cause
    And "80.00" is still in the form
    And no Price Alert is said to have been created

    Examples:
      | fails                              |
      | does not answer                    |
      | answers with an unexpected failure |

  # ---------------------------------------------------------------------------
  # Serving the interface
  # ---------------------------------------------------------------------------

  @SC-31 @BR-13
  Scenario: The root of the application leads to the interface
    When a browser opens "/"
    Then it is taken to "/app/"

  @SC-32 @BR-13
  Scenario Outline: An address under /app/ that is not a file gets the page of the interface, and an address of the API never does
    When a browser opens "<address>"
    Then <answer>

    Examples:
      | address                         | answer                                          |
      | /app/                           | the page of the interface is answered           |
      | /app/listings/headphones-shop-a | the page of the interface is answered           |
      | /app/an/address/that/is/not/one | the page of the interface is answered           |
      | /listings                       | the answer of the API, not the page             |
      | /accounts/me                    | the answer of the API, not the page             |
      | /address-that-is-not-a-route    | the answer of the API for an unknown route, not the page |

  @SC-33 @BR-13
  Scenario Outline: The files of the interface are served with their type, and a file that does not exist is not the page
    When a browser opens "<address>"
    Then <answer>

    Examples:
      | address                         | answer                                                    |
      | /app/assets/index-HASH.js         | the script is served as JavaScript                        |
      | /app/assets/index-HASH.css         | the style sheet is served as CSS                          |
      | /app/assets/missing.js          | the answer is "not found", and it is not the page         |
      | /app/missing.css                | the answer is "not found", and it is not the page         |

  @SC-34 @BR-13
  Scenario Outline: An address that tries to leave the folder of the interface serves nothing outside it
    When a browser opens "<address>"
    Then no file outside the folder of the interface is served
    And the answer is a refusal, "not found" or the page of the interface

    Examples:
      | address                            |
      | /app/../package.json               |
      | /app/%2e%2e/package.json           |
      | /app/..%2fpackage.json             |
      | /app/assets/../../src/main.ts      |
      | /app/%00                           |

  @SC-35 @BR-13
  Scenario: Without the interface, /app/ is an address that does not exist
    Given the application was started without the interface
    When a browser opens "/app/"
    Then the answer is the one of an unknown route, as before this feature

  # ---------------------------------------------------------------------------
  # What only a browser can show
  # ---------------------------------------------------------------------------

  @SC-36 @BR-01
  Scenario: A change that the interface makes is accepted by the application's check of the origin
    Given the person is signed in with a real browser
    When the person creates a Price Alert and signs out from the interface
    Then the application carries both out, and answers neither with a refusal of the origin
