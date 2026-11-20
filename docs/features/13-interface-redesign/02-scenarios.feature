# language: en
# Feature 13 - Interface Redesign. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable behaviour of the interface in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "The person" is whoever uses the interface in a browser. "Signed in" means that the browser holds the cookie of a
# Session that is valid. A "message" is a text of the interface in Spanish: the scenarios say what it tells and the
# design fixes its words. The scenarios do not say colours, sizes or classes: they say what the person can see and do.
# The behaviour of access, of creating, changing and cancelling alerts, and of the notifications is that of
# features 09 and 10, and is not repeated: BR-08 says that it does not change.

Feature: Interface Redesign
  A person sees at a glance what a Listing costs and how its price has moved, and asks to be told when it falls.

  Background:
    Given the person is signed in

  # ---------------------------------------------------------------------------
  # The Catalogue as cards
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-05
  Scenario: Each Listing of the Catalogue is a card with what is needed to choose it
    Given the Catalogue has the Listing "headphones-shop-a" titled "Wireless headphones" at "Shop A" with a Current Price of "100.00" EUR
    When the person opens the Catalogue
    Then the card of that Listing shows the title, the Retailer and the price "100.00" with its currency
    And the card leads to the screen of that Listing

  @SC-02 @BR-01
  Scenario: A Listing with no Current Price says so
    Given the Catalogue has the Listing "monitor-shop-a" with no Current Price
    When the person opens the Catalogue
    Then its card says that it has no price, and it still leads to the Listing

  @SC-03 @BR-08
  Scenario: The Catalogue keeps its order and its pages
    Given the Catalogue has more Listings than fit in a page
    When the person opens the Catalogue and goes to the next page
    Then the cards are in the order that the application gives, as before the redesign

  # ---------------------------------------------------------------------------
  # The Listing and its Price History
  # ---------------------------------------------------------------------------

  @SC-04 @BR-02 @BR-05
  Scenario: The Listing makes its Current Price prominent
    Given the Listing "headphones-shop-a" has a Current Price of "100.00" EUR
    When the person opens that Listing
    Then the title, the Retailer and the price "100.00" with its currency are shown before the rest
    And the form to create a Price Alert is on the same screen

  @SC-05 @BR-02 @BR-03
  Scenario: The Price History is drawn as a chart
    Given the Listing "headphones-shop-a" has observations of "100.00", "95.00" and "90.00" EUR at three moments
    When the person opens that Listing
    Then a chart shows one point for each observation, ordered by its moment
    And the points have the prices "100.00", "95.00" and "90.00"

  @SC-06 @BR-03
  Scenario: An observation with no price is not drawn as a price
    Given the Listing has observations of "100.00" and "90.00" EUR, and between them one with no price
    When the person opens that Listing
    Then the chart has two points
    And no point has the price zero

  @SC-07 @BR-04
  Scenario Outline: With fewer than two points the chart is not drawn
    Given the Listing has <points> observations with a price
    When the person opens that Listing
    Then no chart is drawn, and a note says that there is not enough history

    Examples:
      | points |
      | 0      |
      | 1      |

  @SC-08 @BR-07
  Scenario: The lowest and the highest price of the period are shown
    Given the Listing has observations of "100.00", "79.90" and "90.00" EUR
    When the person opens that Listing
    Then the lowest price "79.90" and the highest price "100.00" are shown
    And they are said to be those of the period shown

  @SC-09 @BR-07
  Scenario: The chart has a text alternative
    Given the Listing has observations with a price
    When the person opens that Listing
    Then the content of the chart can also be read as text, with the price and the moment of each point

  @SC-10 @BR-02
  Scenario: Only the newest observations are drawn
    Given the Listing has more observations than the application gives in one request
    When the person opens that Listing
    Then the chart draws the newest ones that the application gives, and not the older ones

  # ---------------------------------------------------------------------------
  # When the history cannot be read
  # ---------------------------------------------------------------------------

  @SC-11 @BR-06
  Scenario: A failure to read the history does not hide the Listing
    Given the application fails when the Price History of the Listing is read
    When the person opens that Listing
    Then a message says that the history could not be read, with a way to try again
    And the title, the price and the form to create a Price Alert are still shown and work

  @SC-12 @BR-06
  Scenario: Trying again reads the history
    Given the history of the Listing could not be read
    When the person tries again and the application answers
    Then the chart is shown

  @SC-13 @BR-08
  Scenario: A Listing that does not exist keeps its message
    When the person opens the address of a Listing that does not exist
    Then a message says that it does not exist, with a link to the Catalogue, and no chart is asked for

  # ---------------------------------------------------------------------------
  # The rest of the screens
  # ---------------------------------------------------------------------------

  @SC-14 @BR-08
  Scenario Outline: The behaviour of the existing screens does not change
    When the person does "<action>" on the screen "<screen>"
    Then the result is the one that features 09 and 10 specify

    Examples:
      | screen             | action                                    |
      | sign in            | sign in with a wrong password             |
      | register           | register with an email already registered |
      | my alerts          | change the Target Price of an Active one  |
      | my alerts          | cancel an Active one                      |
      | my notifications   | read the Notifications                    |

  @SC-15 @BR-09
  Scenario Outline: The interface can be used on a narrow and on a wide screen
    Given the screen is <width>
    When the person opens the Catalogue and then a Listing
    Then everything that is shown can be read and used without scrolling sideways

    Examples:
      | width                 |
      | that of a phone       |
      | that of a computer    |

  @SC-16 @BR-09
  Scenario Outline: The interface follows the colour mode of the system
    Given the system is in the <mode> mode
    When the person opens the Catalogue
    Then the text can be read against its background

    Examples:
      | mode  |
      | light |
      | dark  |
