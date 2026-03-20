package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.dao.UsersDAO;
import com.example.boveda_digital_api.entity.UsersEntity;
import com.example.boveda_digital_api.services.UsersService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api") // prefijo común para el proxy
public class HelloController {
    private final UsersService usersService;

    public HelloController(UsersService usersService) {
        this.usersService = usersService;
    }

    @GetMapping("/hola")
    public String hola() {
        return "hola desde spring";
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        try {
            List<UsersEntity> users = usersService.getAllUsers();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            // Devuelve un JSON con el error
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


}
