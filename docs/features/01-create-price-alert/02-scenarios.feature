# language: en
# Feature 01 - Create Price Alert. Phase 2: behavioural scenarios.
# Status: Approved
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-business-rules.md

Feature: Create Price Alert
  A User asks to be notified when the Current Price of a Listing reaches a Target Price.
  The system stores the Price Alert so that it can be evaluated later.

  # ---------------------------------------------------------------------------
  # Happy paths
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02 @BR-05 @BR-09
  Scenario: Create a Price Alert with a Target Price below the Current Price
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Price Alert is Active
    And the Price Alert belongs to the User
    And the Price Alert watches the Listing "Headphones at Shop A"
    And the Target Price of the Price Alert is 80.00 EUR

  @SC-02 @BR-06 @BR-09
  Scenario Outline: Create a Price Alert for a Listing that has no Current Price
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has no Current Price because <reason>
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Price Alert is Active

    Examples:
      | reason                  |
      | it is unavailable       |
      | its price is not known  |

  @SC-03 @BR-05
  Scenario: A Target Price just below the Current Price is accepted
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 99.99
    Then a Price Alert is created
    And the Price Alert is Active

  @SC-04 @BR-04
  Scenario: The Target Price is expressed in the currency of the Listing
    Given a User who has signed in
    And the Listing "Headphones at Shop B" has a Current Price of 100.00 USD
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Target Price of the Price Alert is 80.00 USD

  @SC-05 @BR-10
  Scenario: A verified email and a Watchlist are not required
    Given a User who has signed in
    And the email of the User is not verified
    And the Listing "Headphones at Shop A" is not in any Watchlist
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Price Alert is Active

  @SC-06 @BR-07 @BR-10
  Scenario: An Active Price Alert for another Listing does not prevent a new one
    Given a User who has signed in
    And the User has an Active Price Alert for the Listing "Keyboard at Shop A"
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00
    Then a Price Alert is created
    And the User has two Active Price Alerts

  @SC-07 @BR-07
  Scenario: An Active Price Alert of another User does not prevent a new one
    Given a User who has signed in
    And another User has an Active Price Alert for the Listing "Headphones at Shop A"
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Listing has two Active Price Alerts, one for each User

  # ---------------------------------------------------------------------------
  # Validity of the Target Price
  # ---------------------------------------------------------------------------

  @SC-08 @BR-05
  Scenario: A Target Price equal to the Current Price is rejected
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 100.00
    Then the creation is rejected because the Target Price has already been reached
    And no Price Alert is created

  @SC-09 @BR-05
  Scenario: A Target Price above the Current Price is rejected
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 120.00
    Then the creation is rejected because the Target Price has already been reached
    And no Price Alert is created

  @SC-10 @BR-05
  Scenario: The Current Price falls between viewing it and creating the Price Alert
    Given a User who has signed in
    And the User saw the Listing "Headphones at Shop A" with a Current Price of 100.00 EUR
    And the Current Price of that Listing has since fallen to 75.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then the creation is rejected because the Target Price has already been reached
    And no Price Alert is created

  @SC-11 @BR-03
  Scenario Outline: A Target Price that is not greater than zero is rejected
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of <target>
    Then the creation is rejected because the Target Price must be greater than zero
    And no Price Alert is created

    Examples:
      | target |
      | 0.00   |
      | -5.00  |

  @SC-12 @BR-04
  Scenario: A Target Price with more decimals than the currency allows is rejected
    Given a User who has signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 79.999
    Then the creation is rejected because the Target Price has more decimals than the currency allows
    And no Price Alert is created

  # ---------------------------------------------------------------------------
  # Who and on what
  # ---------------------------------------------------------------------------

  @SC-13 @BR-02
  Scenario: A Price Alert cannot be created for a Listing that does not exist
    Given a User who has signed in
    And there is no such Listing
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then the creation is rejected because the Listing does not exist
    And no Price Alert is created

  @SC-14 @BR-01
  Scenario: A visitor who has not signed in cannot create a Price Alert
    Given a visitor who has not signed in
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the visitor tries to create a Price Alert for that Listing with a Target Price of 80.00
    Then the creation is rejected because the visitor must sign in
    And no Price Alert is created

  # ---------------------------------------------------------------------------
  # Duplicates
  # ---------------------------------------------------------------------------

  @SC-15 @BR-07 @BR-08
  Scenario: A different Target Price for a Listing that already has an Active Price Alert is rejected
    Given a User who has signed in
    And the User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 70.00
    Then the creation is rejected as a Duplicate
    And the existing Price Alert keeps its Target Price of 80.00
    And the User has one Active Price Alert for that Listing

  @SC-16 @BR-08
  Scenario: Repeating the same creation returns the existing Price Alert
    Given a User who has signed in
    And the User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then the existing Price Alert is returned
    And no new Price Alert is created
    And the User has one Active Price Alert for that Listing

  @SC-17 @BR-07 @BR-11
  Scenario: A new Price Alert can be created once the previous one is no longer Active
    Given a User who has signed in
    And the User had a Price Alert for the Listing "Headphones at Shop A" that is no longer Active because its Target Price was reached and the User was notified
    And the Listing "Headphones at Shop A" has a Current Price of 100.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then a Price Alert is created
    And the Price Alert is Active

  @SC-18 @BR-05 @BR-08
  Scenario: Repeating the same creation after the Current Price has reached the Target Price returns the existing Price Alert
    Given a User who has signed in
    And the User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00
    And the Current Price of that Listing has since fallen to 75.00 EUR
    When the User creates a Price Alert for that Listing with a Target Price of 80.00
    Then the existing Price Alert is returned
    And no new Price Alert is created
