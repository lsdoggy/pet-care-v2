package com.petcare.backend.task;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;

import com.petcare.backend.error.InvalidRecurrenceRuleException;

/**
 * Sprint 3 — pure unit tests for the simplified recurrence logic
 * (no Spring context / database needed).
 */
class CareTaskRecurrenceTest {

    private static final Instant BASE = Instant.parse("2026-03-10T09:30:00Z");

    @Test
    void monthlyAddsMonths() {
        assertEquals(Instant.parse("2026-04-10T09:30:00Z"),
                CareTaskService.applyRecurrence(BASE, "MONTHLY:1"));
    }

    @Test
    void weeklyAddsWeeks() {
        assertEquals(BASE.plus(14, ChronoUnit.DAYS),
                CareTaskService.applyRecurrence(BASE, "WEEKLY:2"));
    }

    @Test
    void dailyAddsDaysAndYearlyAddsYears() {
        assertEquals(BASE.plus(3, ChronoUnit.DAYS),
                CareTaskService.applyRecurrence(BASE, "DAILY:3"));
        assertEquals(BASE.plus(365, ChronoUnit.DAYS),
                CareTaskService.applyRecurrence(BASE, "YEARLY:1"));
    }

    @Test
    void ruleIsCaseInsensitiveAndTrimmed() {
        assertEquals(Instant.parse("2026-04-10T09:30:00Z"),
                CareTaskService.applyRecurrence(BASE, "  monthly:1 "));
    }

    @Test
    void invalidRulesThrow() {
        assertThrows(InvalidRecurrenceRuleException.class, () -> CareTaskService.applyRecurrence(BASE, "EVERYDAY:1"));
        assertThrows(InvalidRecurrenceRuleException.class, () -> CareTaskService.applyRecurrence(BASE, "MONTHLY"));
        assertThrows(InvalidRecurrenceRuleException.class, () -> CareTaskService.applyRecurrence(BASE, "MONTHLY:0"));
        assertThrows(InvalidRecurrenceRuleException.class, () -> CareTaskService.applyRecurrence(BASE, "MONTHLY:-2"));
        assertThrows(InvalidRecurrenceRuleException.class, () -> CareTaskService.applyRecurrence(BASE, "MONTHLY:abc"));
    }

    @Test
    void normalizeRuleUppercasesAndClearsBlank() {
        assertEquals("MONTHLY:1", CareTaskService.normalizeRule("monthly:1"));
        assertNull(CareTaskService.normalizeRule(""));
        assertNull(CareTaskService.normalizeRule("   "));
        assertNull(CareTaskService.normalizeRule(null));
    }
}
