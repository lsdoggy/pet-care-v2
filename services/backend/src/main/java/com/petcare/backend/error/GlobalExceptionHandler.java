package com.petcare.backend.error;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import io.jsonwebtoken.JwtException;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    public record FieldError(String field, String message) {
    }

    public record ApiError(int status, String error, String message, List<FieldError> details, Instant timestamp) {

        static ApiError of(HttpStatus status, String message, List<FieldError> details) {
            return new ApiError(status.value(), status.getReasonPhrase(), message, details, Instant.now());
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> details = ex.getBindingResult().getFieldErrors().stream()
                .map(it -> new FieldError(it.getField(), it.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, "Validation failed", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex) {
        List<FieldError> details = ex.getConstraintViolations().stream()
                .map(it -> new FieldError(it.getPropertyPath().toString(), it.getMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, "Validation failed", details));
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of(HttpStatus.UNAUTHORIZED, "Invalid email or password", List.of()));
    }

    @ExceptionHandler(JwtException.class)
    ResponseEntity<ApiError> handleJwt(JwtException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of(HttpStatus.UNAUTHORIZED, "Invalid or expired token", List.of()));
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    ResponseEntity<ApiError> handleEmailExists(EmailAlreadyRegisteredException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(HttpStatus.CONFLICT, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(PetNotFoundException.class)
    ResponseEntity<ApiError> handlePetNotFound(PetNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(CareTaskNotFoundException.class)
    ResponseEntity<ApiError> handleCareTaskNotFound(CareTaskNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(AppointmentNotFoundException.class)
    ResponseEntity<ApiError> handleAppointmentNotFound(AppointmentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(RecordNotFoundException.class)
    ResponseEntity<ApiError> handleRecordNotFound(RecordNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(InvalidRecurrenceRuleException.class)
    ResponseEntity<ApiError> handleInvalidRecurrenceRule(InvalidRecurrenceRuleException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, ex.getMessage(),
                        List.of(new FieldError("recurrenceRule",
                                "Expected format UNIT:INTERVAL, e.g. MONTHLY:1, WEEKLY:2, DAILY:1, YEARLY:1"))));
    }

    @ExceptionHandler(AccessDeniedForResourceException.class)
    ResponseEntity<ApiError> handleAccessDenied(AccessDeniedForResourceException ex) {
        // 404 (not 403) — do not leak existence of resources owned by other users.
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(FutureBirthDateException.class)
    ResponseEntity<ApiError> handleFutureBirthDate(FutureBirthDateException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, ex.getMessage(),
                        List.of(new FieldError("birthDate", "Birth date cannot be in the future"))));
    }

    @ExceptionHandler(InvalidFileException.class)
    ResponseEntity<ApiError> handleInvalidFile(InvalidFileException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiError.of(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file is too large (max 5 MB)", List.of()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> handleNotFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND, "Resource not found: /" + ex.getResourcePath(), List.of()));
    }
}
