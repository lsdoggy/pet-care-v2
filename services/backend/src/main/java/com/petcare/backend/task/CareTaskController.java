package com.petcare.backend.task;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.petcare.backend.task.dto.CareTaskDto;
import com.petcare.backend.task.dto.CreateTaskRequest;
import com.petcare.backend.task.dto.UpdateTaskRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/tasks")
public class CareTaskController {

    private final CareTaskService careTaskService;

    public CareTaskController(CareTaskService careTaskService) {
        this.careTaskService = careTaskService;
    }

    /** All tasks of the currently authenticated user, ordered by due date. */
    @GetMapping
    List<CareTaskDto> list(Authentication authentication) {
        return careTaskService.listMyTasks(authentication.getName());
    }

    /** Pending tasks of the current user, nearest due_at first (UTC). */
    @GetMapping("/upcoming")
    List<CareTaskDto> upcoming(Authentication authentication) {
        return careTaskService.listUpcoming(authentication.getName());
    }

    @GetMapping("/{id}")
    CareTaskDto get(@PathVariable Long id, Authentication authentication) {
        return careTaskService.getTask(id, authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CareTaskDto create(@Valid @RequestBody CreateTaskRequest request, Authentication authentication) {
        return careTaskService.createTask(request, authentication.getName());
    }

    @PatchMapping("/{id}")
    CareTaskDto update(@PathVariable Long id,
                       @Valid @RequestBody UpdateTaskRequest request,
                       Authentication authentication) {
        return careTaskService.updateTask(id, request, authentication.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id, Authentication authentication) {
        careTaskService.deleteTask(id, authentication.getName());
    }

    /** Marks the task as done; if it has a recurrence rule, spawns the next pending task. */
    @PostMapping("/{id}/complete")
    CareTaskDto complete(@PathVariable Long id, Authentication authentication) {
        return careTaskService.completeTask(id, authentication.getName());
    }
}
