package com.petcare.backend.notification;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Jwts;

@Component
class WebPushTransport {

    private static final Duration TOKEN_LIFETIME = Duration.ofHours(12);

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final ConcurrentHashMap<String, VapidToken> tokens = new ConcurrentHashMap<>();
    private final String publicKey;
    private final ECPrivateKey privateKey;
    private final String subject;

    WebPushTransport(
            @Value("${WEB_PUSH_VAPID_PUBLIC_KEY:}") String publicKey,
            @Value("${WEB_PUSH_VAPID_PRIVATE_KEY:}") String privateKey,
            @Value("${WEB_PUSH_VAPID_SUBJECT:}") String subject) {
        this.publicKey = publicKey;
        this.subject = subject;
        if (publicKey.isBlank() && privateKey.isBlank() && subject.isBlank()) {
            this.privateKey = null;
            return;
        }

        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            ECParameterSpec curve = parameters.getParameterSpec(ECParameterSpec.class);
            KeyFactory keyFactory = KeyFactory.getInstance("EC");
            byte[] point = Base64.getUrlDecoder().decode(publicKey);
            byte[] scalar = Base64.getUrlDecoder().decode(privateKey);
            URI contact = URI.create(subject);
            if (publicKey.length() != 87 || privateKey.length() != 43
                    || point.length != 65 || point[0] != 4 || scalar.length != 32
                    || !("mailto".equals(contact.getScheme())
                            || ("https".equals(contact.getScheme()) && contact.getHost() != null))) {
                throw new IllegalArgumentException();
            }
            ECPoint coordinates = new ECPoint(new BigInteger(1, Arrays.copyOfRange(point, 1, 33)),
                    new BigInteger(1, Arrays.copyOfRange(point, 33, 65)));
            ECPublicKey verificationKey = (ECPublicKey) keyFactory.generatePublic(
                    new ECPublicKeySpec(coordinates, curve));
            this.privateKey = (ECPrivateKey) keyFactory.generatePrivate(
                    new ECPrivateKeySpec(new BigInteger(1, scalar), curve));

            // Reject a mismatched key pair before reporting Web Push as available.
            Jwts.parser().verifyWith(verificationKey).build()
                    .parseSignedClaims(createToken("https://web.push.apple.com", Instant.now()).jwt());
        } catch (GeneralSecurityException | IllegalArgumentException | io.jsonwebtoken.JwtException e) {
            throw new IllegalStateException("Invalid Web Push VAPID configuration");
        }
    }

    boolean enabled() {
        return privateKey != null;
    }

    String publicKey() {
        return publicKey;
    }

    static URI validateEndpoint(String value) {
        URI endpoint = URI.create(value);
        String host = endpoint.getHost();
        if (!"https".equals(endpoint.getScheme()) || host == null
                || !host.endsWith(".push.apple.com") || !host.equals(host.toLowerCase(Locale.ROOT))
                || !endpoint.toASCIIString().equals(value)
                || endpoint.getRawUserInfo() != null || endpoint.getPort() != -1
                || endpoint.getRawFragment() != null || endpoint.getRawQuery() != null
                || endpoint.getRawPath().length() < 2) {
            throw new IllegalArgumentException("Invalid Apple Web Push endpoint");
        }
        return endpoint;
    }

    int send(String value) throws java.io.IOException, InterruptedException {
        URI endpoint = validateEndpoint(value);
        String audience = "https://" + endpoint.getHost();
        Instant now = Instant.now();
        VapidToken token = tokens.compute(audience, (key, existing) ->
                existing != null && existing.expiry().isAfter(now.plusSeconds(60))
                        ? existing : createToken(key, now));
        // Payloadless Web Push: the service worker supplies neutral text and a fixed route.
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "vapid t=" + token.jwt() + ", k=" + publicKey)
                .header("TTL", "300")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private VapidToken createToken(String audience, Instant now) {
        Instant expiry = now.plus(TOKEN_LIFETIME);
        String jwt = Jwts.builder().subject(subject).audience().add(audience).and()
                .expiration(Date.from(expiry)).signWith(privateKey, Jwts.SIG.ES256).compact();
        return new VapidToken(jwt, expiry);
    }

    private record VapidToken(String jwt, Instant expiry) {}
}
