FROM eclipse-temurin:25-jdk AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY src/ src/
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:25-jre
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 petcare \
    && useradd --uid 10001 --gid 10001 --no-create-home petcare \
    && install -d -o petcare -g petcare /app/uploads
WORKDIR /app
COPY --from=build /build/target/*.jar /app/backend.jar
USER 10001:10001
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
