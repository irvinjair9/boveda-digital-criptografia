package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.entity.UsersEntity;
import com.example.boveda_digital_api.services.UsersService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UsersService usersService;

    public AuthController(UsersService usersService) {
        this.usersService = usersService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        Optional<UsersEntity> user = usersService.login(username, password);

        if (user.isPresent()) {
            return ResponseEntity.ok(Map.of(
                "message", "Login exitoso",
                "user", Map.of(
                    "id", user.get().getId(),
                    "name", user.get().getName(),
                    "email", user.get().getEmail(),
                    "username", user.get().getUsername()
                )
            ));
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Credenciales inválidas"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UsersEntity userData) {
        if (usersService.findByUsername(userData.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "El nombre de usuario ya existe"));
        }

        UsersEntity saved = usersService.registerUser(userData);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "Usuario registrado exitosamente",
            "user", Map.of(
                "id", saved.getId(),
                "name", saved.getName(),
                "email", saved.getEmail(),
                "username", saved.getUsername()
            )
        ));
    }
}
