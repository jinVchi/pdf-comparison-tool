FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp package -Dmaven.test.skip=true
FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends fonts-ipafont-gothic tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 --create-home sabun
WORKDIR /app
RUN mkdir -p /app/.data && chown -R sabun /app
COPY --from=build /build/target/sabun-api-1.0.0.jar app.jar
USER sabun
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx768m", "-Djava.awt.headless=true", "-jar", "app.jar"]
