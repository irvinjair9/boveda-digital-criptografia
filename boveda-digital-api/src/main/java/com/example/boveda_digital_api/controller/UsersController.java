package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.entity.UsersEntity;
import com.example.boveda_digital_api.services.UsersService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/users")
public class UsersController {
    private final UsersService usersService;

    public UsersController(UsersService usersService) {
        this.usersService = usersService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<UsersEntity> users = usersService.getAllUsers();
        List<Map<String, Object>> result = new ArrayList<>();

        for (UsersEntity user : users) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("name", user.getName());
            userMap.put("last_name", user.getLastName());
            userMap.put("public_key", user.getPublicKey());
            result.add(userMap);
        }

        return ResponseEntity.ok(result);
    }
}
