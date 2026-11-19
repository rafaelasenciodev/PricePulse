# language: en
# Feature 02 - Price Observation. Phase 2: behavioural scenarios.
# Status: Draft
#
# Scenarios describe observable business behaviour in the project's ubiquitous language.
# Each scenario has an identifier (@SC-nn) and the business rules it exercises (@BR-nn).
# Rules: 01-business-rules.md
#
# A Price Observation has a Price that may be absent. Without a Price, the Listing is unavailable.
# BR-13 has no scenario by design: while the set of Providers is closed and has one member,
# the case it describes cannot happen.

Feature: Record Price Observation
  A Provider reports the Price of a Listing at a point in time, or that it had none.
  The system stores the Price Observation, and the Current Price of the Listing follows from the stored ones.

  # ---------------------------------------------------------------------------
  # Happy paths
  # ---------------------------------------------------------------------------

  @SC-01 @BR-01 @BR-02 @BR-03 @BR-05 @BR-06 @BR-07
  Scenario: Record a Price Observation with a Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing with a Price of 79.90 and an Observed At of 10:00
    Then the Price Observation is stored
    And it belongs to the Provider "simulator"
    And it states that the Listing had a Price of 79.90 EUR at 10:00
    And the Current Price of the Listing is 79.90 EUR

  @SC-02 @BR-03 @BR-07
  Scenario: Record a Price Observation without a Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing without a Price and with an Observed At of 10:00
    Then the Price Observation is stored
    And it states that the Listing was unavailable at 10:00
    And the Listing has no Current Price

  @SC-03 @BR-04
  Scenario: A Price of zero is accepted
    Given an authenticated Provider "simulator"
    And the Listing "Online course at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing with a Price of 0.00 and an Observed At of 10:00
    Then the Price Observation is stored
    And the Current Price of the Listing is 0.00 EUR

  @SC-04 @BR-06 @BR-07
  Scenario: A later Price Observation defines the Current Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing with a Price of 90.00 and an Observed At of 11:00
    Then the Price Observation is stored
    And the Current Price of the Listing is 90.00 EUR
    And the Listing has two stored Price Observations

  @SC-05 @BR-06
  Scenario: A Price Observation equal to the previous one is also stored
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing with a Price of 100.00 and an Observed At of 11:00
    Then the Price Observation is stored
    And the Listing has two stored Price Observations
    And the Current Price of the Listing is 100.00 EUR

  @SC-06 @BR-03 @BR-07
  Scenario: A Listing whose latest Price Observation has no Price has no Current Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing without a Price and with an Observed At of 11:00
    Then the Price Observation is stored
    And the Listing has no Current Price

  @SC-07 @BR-07
  Scenario: A Listing that has a Price again has the new Price as Current Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    And the Listing has a later stored Price Observation without a Price, observed at 11:00
    When the Provider records a Price Observation of that Listing with a Price of 95.00 and an Observed At of 12:00
    Then the Price Observation is stored
    And the Current Price of the Listing is 95.00 EUR

  @SC-08 @BR-07
  Scenario: A Listing with no Price Observation has no Current Price
    Given the Listing "Headphones at Shop A" has no stored Price Observation
    Then the Listing has no Current Price

  # ---------------------------------------------------------------------------
  # Order in time
  # ---------------------------------------------------------------------------

  @SC-09 @BR-06 @BR-07 @BR-08
  Scenario: An older Price Observation is stored and does not change the Current Price
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 90.00 EUR, observed at 11:00
    When the Provider records a Price Observation of that Listing with a Price of 100.00 and an Observed At of 10:00
    Then the Price Observation is stored
    And the Current Price of the Listing is still 90.00 EUR
    And the Listing has two stored Price Observations

  @SC-10 @BR-12
  Scenario: An Observed At slightly later than the moment of recording is accepted
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing whose Observed At is later than the moment of recording, within the tolerance for clock differences
    Then the Price Observation is stored

  @SC-11 @BR-12
  Scenario: An Observed At later than the moment of recording, beyond the tolerance, is rejected
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing whose Observed At is later than the moment of recording, beyond the tolerance for clock differences
    Then the recording is rejected because the Observed At is in the future
    And no Price Observation is stored
    And the Current Price of the Listing is still 100.00 EUR

  # ---------------------------------------------------------------------------
  # Validity of the Price
  # ---------------------------------------------------------------------------

  @SC-12 @BR-04
  Scenario: A negative Price is rejected
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing with a Price of -5.00 and an Observed At of 10:00
    Then the recording is rejected because the Price cannot be negative
    And no Price Observation is stored

  @SC-13 @BR-05
  Scenario: A Price with more decimals than the currency allows is rejected
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing with a Price of 79.999 and an Observed At of 10:00
    Then the recording is rejected because the Price has more decimals than the currency allows
    And no Price Observation is stored

  @SC-14 @BR-05
  Scenario: A Price in another currency than the Listing is rejected
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" is priced in EUR
    When the Provider records a Price Observation of that Listing with a Price of 79.90 USD and an Observed At of 10:00
    Then the recording is rejected because the currency is not the one of the Listing
    And no Price Observation is stored

  # ---------------------------------------------------------------------------
  # Who and on what
  # ---------------------------------------------------------------------------

  @SC-15 @BR-02
  Scenario: A Price Observation cannot be recorded for a Listing that does not exist
    Given an authenticated Provider "simulator"
    And there is no such Listing
    When the Provider records a Price Observation of that Listing with a Price of 79.90 and an Observed At of 10:00
    Then the recording is rejected because the Listing does not exist
    And no Price Observation is stored

  @SC-16 @BR-01
  Scenario: A caller who is not authenticated cannot record a Price Observation
    Given a caller who is not authenticated
    And the Listing "Headphones at Shop A" is priced in EUR
    When the caller tries to record a Price Observation of that Listing with a Price of 79.90 and an Observed At of 10:00
    Then the recording is rejected because the caller must be authenticated
    And no Price Observation is stored

  @SC-17 @BR-01
  Scenario: A User who has signed in cannot record a Price Observation
    Given a User who has signed in
    And the Listing "Headphones at Shop A" is priced in EUR
    When the User tries to record a Price Observation of that Listing with a Price of 79.90 and an Observed At of 10:00
    Then the recording is rejected because only a Provider can record a Price Observation
    And no Price Observation is stored

  # ---------------------------------------------------------------------------
  # Resends
  # ---------------------------------------------------------------------------

  @SC-18 @BR-09
  Scenario Outline: Repeating the same recording returns the existing Price Observation
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation of the Provider, <content>, observed at 10:00
    When the Provider records again a Price Observation of that Listing with the same content and an Observed At of 10:00
    Then the existing Price Observation is returned
    And no new Price Observation is stored
    And the Listing has one stored Price Observation

    Examples:
      | content                |
      | with a Price of 79.90  |
      | without a Price        |

  @SC-19 @BR-10
  Scenario: The same Observed At with a different Price is rejected as a Conflict
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation of the Provider with a Price of 79.90 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing with a Price of 85.00 and an Observed At of 10:00
    Then the recording is rejected as a Conflict
    And the stored Price Observation keeps its Price of 79.90 EUR
    And the Listing has one stored Price Observation

  @SC-20 @BR-10
  Scenario: The same Observed At without a Price, against a stored Price, is rejected as a Conflict
    Given an authenticated Provider "simulator"
    And the Listing "Headphones at Shop A" has a stored Price Observation of the Provider with a Price of 79.90 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing without a Price and with an Observed At of 10:00
    Then the recording is rejected as a Conflict
    And the stored Price Observation keeps its Price of 79.90 EUR

  # ---------------------------------------------------------------------------
  # Boundaries
  # ---------------------------------------------------------------------------

  @SC-21 @BR-11
  Scenario: Recording a Price Observation does not evaluate Price Alerts
    Given an authenticated Provider "simulator"
    And a User has an Active Price Alert for the Listing "Headphones at Shop A" with a Target Price of 80.00
    And the Listing has a stored Price Observation with a Price of 100.00 EUR, observed at 10:00
    When the Provider records a Price Observation of that Listing with a Price of 75.00 and an Observed At of 11:00
    Then the Price Observation is stored
    And the Price Alert is still Active
    And no notification is produced
