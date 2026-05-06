package com.example.boveda_digital_api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.example.boveda_digital_api.services.ErrorLogService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class BovedaDigitalApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(BovedaDigitalApiApplication.class, args);
	}

}
