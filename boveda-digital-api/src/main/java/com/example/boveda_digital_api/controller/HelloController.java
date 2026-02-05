package com.example.boveda_digital_api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api") // prefijo común para el proxy
public class HelloController {

    @GetMapping("/hola")
    public String hola() {
        return "hola desde spring";
    }

}
