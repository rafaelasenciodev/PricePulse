# language: en
# Feature 07 - Listings Catalogue. Stage 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-discovery.md, section 6
#
# "Not found" means that the Listing is not in the Catalogue. "Not authenticated" means that the request
# does not carry the valid token of a User. A page is "empty" when it has no Listings, whatever the total.

Feature: Listings Catalogue
  A User reads the Listings that the system knows, with the Current Price of each, to choose one to
  watch. Reading changes nothing, and nobody changes the Catalogue through the API.

  # ---------------------------------------------------------------------------
  # Reading the Catalogue
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02
  Scenario: A User reads the Listings of the Catalogue
    Given the Catalogue has the Listing "keyboard-shop-b", titled "Mechanical keyboard" by the Retailer "Shop B", in USD
    And the Catalogue has the Listing "headphones-shop-a", titled "Wireless headphones" by the Retailer "Shop A", in EUR
    When a User reads the Catalogue
    Then the answer has 2 Listings and a total of 2
    And each Listing shows its identifier, its title, the name of its Retailer and its currency

  @SC-02 @BR-01
  Scenario: Listings are ordered by title and then by identifier
    Given the Catalogue has the Listing "monitor-shop-a" titled "Monitor"
    And the Catalogue has the Listing "headphones-shop-b" titled "Wireless headphones"
    And the Catalogue has the Listing "headphones-shop-a" titled "Wireless headphones"
    And the Catalogue has the Listing "keyboard-shop-b" titled "Mechanical keyboard"
    When a User reads the Catalogue
    Then the Listings come in this order
      | identifier        |
      | keyboard-shop-b   |
      | monitor-shop-a    |
      | headphones-shop-a |
      | headphones-shop-b |

  @SC-03 @BR-01
  Scenario: An empty Catalogue is an empty page
    Given the Catalogue has no Listings
    When a User reads the Catalogue
    Then the page is empty and the total is 0

  # ---------------------------------------------------------------------------
  # The Current Price of a Listing
  # ---------------------------------------------------------------------------

  @SC-04 @BR-02 @BR-03
  Scenario: A Listing shows its Current Price and when it was observed
    Given the Listing "headphones-shop-a" has a Price Observation of 100.00 EUR observed at "2026-11-19T10:00:00Z"
    When a User reads the Catalogue
    Then "headphones-shop-a" shows the Current Price 100.00 EUR
    And it shows that the price was observed at "2026-11-19T10:00:00Z"

  @SC-05 @BR-03
  Scenario: A Listing with no Price Observation shows no Current Price
    Given the Listing "monitor-shop-a" has no Price Observation
    When a User reads the Catalogue
    Then "monitor-shop-a" shows no Current Price

  @SC-06 @BR-03
  Scenario: A Listing whose latest observation has no Price shows no Current Price
    Given the Listing "monitor-shop-a" has a Price Observation of 50.00 EUR observed at "2026-11-19T09:00:00Z"
    And the Listing "monitor-shop-a" has a later Price Observation, with no Price, observed at "2026-11-19T10:00:00Z"
    When a User reads the Catalogue
    Then "monitor-shop-a" shows no Current Price

  @SC-07 @BR-03
  Scenario: The Current Price is the one with the greatest Observed At, whoever reported it and whenever it arrived
    Given the Provider "simulator" recorded 90.00 EUR for "headphones-shop-a", observed at "2026-11-19T10:00:00Z"
    And the Provider "other" recorded 95.00 EUR for "headphones-shop-a", observed at "2026-11-19T09:00:00Z", after the first
    When a User reads the Catalogue
    Then "headphones-shop-a" shows the Current Price 90.00 EUR

  @SC-08 @BR-03
  Scenario: Each Listing shows its own Current Price
    Given the Listing "headphones-shop-a" has a Price Observation of 100.00 EUR
    And the Listing "keyboard-shop-b" has a Price Observation of 50.00 USD
    When a User reads the Catalogue
    Then "headphones-shop-a" shows 100.00 EUR
    And "keyboard-shop-b" shows 50.00 USD

  @SC-09 @BR-03 @BR-05
  Scenario: A price recorded after a read is shown by the next one
    Given the Listing "headphones-shop-a" has a Price Observation of 100.00 EUR
    And a User read the Catalogue
    When a Provider records 79.90 EUR for "headphones-shop-a", observed later
    And the User reads the Catalogue again
    Then "headphones-shop-a" shows the Current Price 79.90 EUR

  # ---------------------------------------------------------------------------
  # Pages
  # ---------------------------------------------------------------------------

  @SC-10 @BR-01 @BR-07
  Scenario: A page holds 20 Listings unless another size is asked for
    Given the Catalogue has 25 Listings
    When a User reads the Catalogue without a limit
    Then the page has 20 Listings
    And the total is 25
    And the limit shown is 20 and the offset is 0

  @SC-11 @BR-01 @BR-07
  Scenario: The next page continues where the previous one stopped
    Given the Catalogue has 25 Listings
    When a User reads the Catalogue with an offset of 20
    Then the page has 5 Listings
    And they are the last 5 in the order of the Catalogue
    And the total is 25

  @SC-12 @BR-07
  Scenario: A page beyond the end is empty and still says the total
    Given the Catalogue has 3 Listings
    When a User reads the Catalogue with an offset of 10
    Then the page is empty and the total is 3

  @SC-13 @BR-07
  Scenario Outline: The limit and the offset have bounds
    Given the Catalogue has 3 Listings
    When a User reads the Catalogue with a limit of <limit> and an offset of <offset>
    Then <outcome>

    Examples:
      | limit | offset | outcome                                       |
      | 1     | 0      | the page has 1 Listing and the total is 3     |
      | 100   | 0      | the page has 3 Listings and the total is 3    |
      | 0     | 0      | the request is rejected as not valid          |
      | 101   | 0      | the request is rejected as not valid          |
      | 20    | -1     | the request is rejected as not valid          |
      | abc   | 0      | the request is rejected as not valid          |

  @SC-14 @BR-07
  Scenario: A parameter that is not part of the request is rejected
    When a User reads the Catalogue with a parameter that does not exist
    Then the request is rejected as not valid

  # ---------------------------------------------------------------------------
  # Reading one Listing
  # ---------------------------------------------------------------------------

  @SC-15 @BR-02 @BR-03 @BR-04
  Scenario: A User reads one Listing
    Given the Catalogue has the Listing "headphones-shop-a", titled "Wireless headphones" by the Retailer "Shop A", in EUR
    And it has a Price Observation of 100.00 EUR observed at "2026-11-19T10:00:00Z"
    When a User reads the Listing "headphones-shop-a"
    Then the answer is the same view of the Listing that the Catalogue shows
    And it shows the Current Price 100.00 EUR and when it was observed

  @SC-16 @BR-03 @BR-04
  Scenario: One Listing with no Current Price is still found
    Given the Listing "monitor-shop-a" has no Price Observation
    When a User reads the Listing "monitor-shop-a"
    Then the Listing is found and shows no Current Price

  @SC-17 @BR-04
  Scenario: A Listing that is not in the Catalogue is not found
    When a User reads the Listing "no-such-listing"
    Then the Listing is not found

  # ---------------------------------------------------------------------------
  # Who can read it
  # ---------------------------------------------------------------------------

  @SC-18 @BR-06
  Scenario Outline: A request that does not carry the valid token of a User is not authenticated
    When a request <what> reads <target>
    Then the request is not authenticated

    Examples:
      | what                                    | target              |
      | with no token                           | the Catalogue       |
      | with a token that nobody has            | the Catalogue       |
      | with the token of a Provider            | the Catalogue       |
      | with no token                           | one Listing         |
      | with a token that nobody has            | one Listing         |
      | with the token of a Provider            | one Listing         |

  @SC-19 @BR-06
  Scenario: A request that is not authenticated learns nothing
    When a request with no token reads the Catalogue with a limit that is not valid
    Then the request is not authenticated, and not rejected as not valid
    When a request with no token reads a Listing that is not in the Catalogue
    Then the request is not authenticated, and not reported as not found

  # ---------------------------------------------------------------------------
  # Reading changes nothing, and nobody changes the Catalogue
  # ---------------------------------------------------------------------------

  @SC-20 @BR-05
  Scenario: Reading the Catalogue changes nothing
    Given the Catalogue has Listings, Price Observations and Price Alerts
    When a User reads the Catalogue and then reads each Listing
    Then the Listings, the Price Observations and the Price Alerts are as they were
    And reading again gives the same answer

  @SC-21 @BR-08
  Scenario Outline: There is no request that adds, changes or removes a Listing
    When a User sends <request>
    Then there is no such route

    Examples:
      | request                                                   |
      | a POST to the Catalogue with a new Listing                |
      | a PUT to the Catalogue                                    |
      | a DELETE to the Catalogue                                 |
      | a PUT to one Listing with another title                   |
      | a PATCH to one Listing with another title                 |
      | a DELETE to one Listing                                   |
