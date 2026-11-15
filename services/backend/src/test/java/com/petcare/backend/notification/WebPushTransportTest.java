package com.petcare.backend.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WebPushTransportTest {

    @Test
    void vapidRequiresAnEcP256KeyPairAndContact() throws Exception {
        var generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        var keys = generator.generateKeyPair();
        var publicPoint = ((ECPublicKey) keys.getPublic()).getW();
        var privateScalar = ((ECPrivateKey) keys.getPrivate()).getS();
        String publicKey = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteBuffer.allocate(65)
                .put((byte) 4).put(rawCoordinate(publicPoint.getAffineX())).put(rawCoordinate(publicPoint.getAffineY()))
                .array());
        String privateKey = Base64.getUrlEncoder().withoutPadding().encodeToString(rawCoordinate(privateScalar));

        assertThat(new WebPushTransport("", "", "").enabled()).isFalse();
        assertThat(new WebPushTransport(publicKey, privateKey, "mailto:push@example.test").enabled()).isTrue();
        assertThatThrownBy(() -> new WebPushTransport(publicKey, "", "mailto:push@example.test"))
                .isInstanceOf(IllegalStateException.class).hasMessage("Invalid Web Push VAPID configuration");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "http://web.push.apple.com/slot",
        "https://web.push.apple.com.evil.test/slot",
        "https://web.push.apple.com@elsewhere.test/slot",
        "https://example.test@web.push.apple.com/slot",
        "https://web.push.apple.com:8000/slot",
        "https://127.0.0.1/slot",
        "https://web.push.apple.com/"
    })
    void onlyAcceptsApplePushEndpoints(String endpoint) {
        assertThatThrownBy(() -> WebPushTransport.validateEndpoint(endpoint))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static byte[] rawCoordinate(BigInteger coordinate) {
        byte[] encoded = coordinate.toByteArray();
        byte[] raw = new byte[32];
        int length = Math.min(encoded.length, raw.length);
        System.arraycopy(encoded, encoded.length - length, raw, raw.length - length, length);
        return raw;
    }
}
